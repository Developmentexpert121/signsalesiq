import type { Express, Request, Response } from "express";
import path from "path";
import { generateComposite } from "../compositeService";
import { convertToPng, isConvertibleFile, isUnsupportedVectorFile } from "../fileConvert";
import { generateGeminiMockup, type MockupReference } from "../geminiMockupService";
import { generateComplianceText, generateRationale } from "../llmService";
import { logger } from "../logger";
import { requireAuth } from "../middleware/requireAuth";
import { requireSuperAdmin } from "../middleware/requireRole";
import { selectReferences } from "../mockup/referenceUtils";
import { isFullSceneOnly } from "../mockup/signTaxonomy";
import {
  buildGenerationContext,
  getGenerationTiers,
  generateOutputMockup,
  loadFewShotExamples,
  straightenPoints,
} from "../mockupGenerationService";
import { saveUpload } from "../objectStore";
import {
  findForbiddenSignSpecPatchField,
  hasGenerationContextChanged,
} from "../signSpecIsolation";
import { lookupSignCode } from "../signCodeService";
import { latestAssetOfType, storage } from "../storage";
import { upload } from "../upload";

export function registerSignSpecRoutes(app: Express) {
  app.get("/api/opportunities/:id/sign-specs", requireAuth, async (req: Request, res: Response) => {
    const specs = await storage.getSignSpecs(req.params.id as string);
    res.json(specs);
  });

  app.post(
    "/api/opportunities/:id/sign-specs",
    requireAuth,
    async (req: Request, res: Response) => {
      const forbiddenField = findForbiddenSignSpecPatchField(req.body || {});
      if (forbiddenField) {
        return res.status(400).json({
          message: `Field "${forbiddenField}" cannot be set through this endpoint`,
        });
      }
      const spec = await storage.createSignSpec({
        opportunityId: req.params.id as string,
        ...req.body,
      });
      res.json(spec);
    }
  );

  app.patch("/api/sign-specs/:id", requireAuth, async (req: Request, res: Response) => {
    const existing = await storage.getSignSpec(req.params.id as string);
    if (!existing) return res.status(404).json({ message: "Not found" });

    const forbiddenField = findForbiddenSignSpecPatchField(req.body || {});
    if (forbiddenField) {
      return res.status(400).json({
        message: `Field "${forbiddenField}" cannot be changed through this endpoint`,
      });
    }

    const invalidatesOutputs = hasGenerationContextChanged(existing, req.body || {});
    const spec = await storage.updateSignSpec(req.params.id as string, req.body);
    if (!spec) return res.status(404).json({ message: "Not found" });

    if (invalidatesOutputs) {
      await storage.deleteOutputsBySignSpec(spec.id);
    }

    const MIRRORED_FIELDS = [
      "signType",
      "locationType",
      "budgetRange",
      "signDuration",
      "targetAudience",
      "showSignCode",
      "promptBox",
    ] as const;
    const mirroredUpdates: Record<string, unknown> = {};
    for (const key of MIRRORED_FIELDS) {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, key)) {
        mirroredUpdates[key] = req.body[key];
      }
    }
    if (Object.keys(mirroredUpdates).length > 0) {
      const siblings = await storage.getSignSpecs(spec.opportunityId);
      if (siblings[0]?.id === spec.id) {
        await storage.updateOpportunity(spec.opportunityId, mirroredUpdates);
      }
    }

    res.json(spec);
  });

  app.delete("/api/sign-specs/:id", requireAuth, async (req: Request, res: Response) => {
    await storage.deleteSignSpec(req.params.id as string);
    res.json({ success: true });
  });

  app.post(
    "/api/sign-specs/:id/upload-photo",
    requireAuth,
    upload.single("file"),
    async (req: Request, res: Response) => {
      const spec = await storage.getSignSpec(req.params.id as string);
      if (!spec) return res.status(404).json({ message: "Not found" });
      if (isFullSceneOnly(spec.signType)) {
        return res.status(409).json({ message: "Site photo not applicable for this sign type" });
      }
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      if (isUnsupportedVectorFile(req.file.originalname)) {
        return res
          .status(400)
          .json({ message: "Unsupported file format. Please use PNG, JPG, SVG, or PDF." });
      }

      let finalFilename = req.file.filename;
      let finalMimeType = req.file.mimetype;
      let finalBuffer = req.file.buffer;
      let width: number | undefined;
      let height: number | undefined;

      if (isConvertibleFile(req.file.originalname)) {
        try {
          const result = await convertToPng(req.file.buffer, req.file.originalname);
          finalFilename = result.filename;
          finalMimeType = "image/png";
          finalBuffer = result.buffer;
          width = result.width;
          height = result.height;
        } catch (err: any) {
          return res.status(400).json({ message: `Failed to convert file: ${err.message}` });
        }
      } else {
        try {
          const sharp = (await import("sharp")).default;
          const baseName = path.basename(req.file.filename, path.extname(req.file.filename));
          finalFilename = `${baseName}_n.png`;
          finalBuffer = await sharp(req.file.buffer).rotate().png().toBuffer();
          finalMimeType = "image/png";
          const meta = await sharp(finalBuffer).metadata();
          width = meta.width;
          height = meta.height;
        } catch (err: any) {
          logger.warn(`[Upload Photo] EXIF normalization failed, using original: ${err.message}`);
          try {
            const sharp = (await import("sharp")).default;
            const meta = await sharp(req.file.buffer).metadata();
            width = meta.width;
            height = meta.height;
          } catch {}
        }
      }

      await saveUpload(finalFilename, finalBuffer, finalMimeType);

      const previousCanvasAssetId = spec.canvasAssetId;

      const asset = await storage.createAsset({
        opportunityId: spec.opportunityId,
        type: "CANVAS",
        filename: finalFilename,
        mimeType: finalMimeType,
        width: width ?? null,
        height: height ?? null,
      });

      await storage.updateSignSpec(spec.id, { canvasAssetId: asset.id });

      // The new site photo invalidates any existing mockups (they were composited
      // onto the previous photo or a generated full scene). Clear them so the PDF
      // never shows a mockup that doesn't match the current photo until it is
      // regenerated. No-op on a first upload (the spec has no outputs yet).
      await storage.deleteOutputsBySignSpec(spec.id);

      // Re-upload replaces the site photo: drop the previous CANVAS asset so it
      // can't resurface in the PDF's "latest CANVAS" fallback. Only delete it if
      // no sibling spec still references it.
      if (previousCanvasAssetId && previousCanvasAssetId !== asset.id) {
        const siblings = await storage.getSignSpecs(spec.opportunityId);
        const stillReferenced = siblings.some(
          (s) => s.id !== spec.id && s.canvasAssetId === previousCanvasAssetId
        );
        if (!stillReferenced) {
          try {
            await storage.deleteAsset(previousCanvasAssetId);
          } catch (err: any) {
            logger.warn(`[Upload Photo] Failed to delete old canvas asset: ${err?.message || err}`);
          }
        }
      }

      res.json({ asset, spec: { ...spec, canvasAssetId: asset.id } });
    }
  );

  app.post(
    "/api/sign-specs/:id/upload-logo",
    requireAuth,
    upload.single("file"),
    async (req: Request, res: Response) => {
      const spec = await storage.getSignSpec(req.params.id as string);
      if (!spec) return res.status(404).json({ message: "Not found" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      if (isUnsupportedVectorFile(req.file.originalname)) {
        return res
          .status(400)
          .json({ message: "Unsupported file format. Please use PNG, JPG, SVG, or PDF." });
      }

      const LOGO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
      if (req.file.size > LOGO_MAX_BYTES) {
        return res.status(413).json({ message: "Logo file is too large. Maximum size is 10 MB." });
      }

      let finalFilename = req.file.filename;
      let finalMimeType = req.file.mimetype;
      let finalBuffer = req.file.buffer;
      let width: number | undefined;
      let height: number | undefined;

      if (isConvertibleFile(req.file.originalname)) {
        try {
          const result = await convertToPng(req.file.buffer, req.file.originalname);
          finalFilename = result.filename;
          finalMimeType = "image/png";
          finalBuffer = result.buffer;
          width = result.width;
          height = result.height;
        } catch (err: any) {
          return res.status(400).json({ message: `Failed to convert file: ${err.message}` });
        }
      } else {
        try {
          const sharp = (await import("sharp")).default;
          const meta = await sharp(req.file.buffer).metadata();
          width = meta.width;
          height = meta.height;
        } catch {}
      }

      await saveUpload(finalFilename, finalBuffer, finalMimeType);

      const previousLogoAssetId = spec.logoAssetId;
      const asset = await storage.createAsset({
        opportunityId: spec.opportunityId,
        type: "LOGO",
        filename: finalFilename,
        mimeType: finalMimeType,
        width: width ?? null,
        height: height ?? null,
      });

      await storage.updateSignSpec(spec.id, { logoAssetId: asset.id });
      await storage.deleteOutputsBySignSpec(spec.id);

      if (previousLogoAssetId && previousLogoAssetId !== asset.id) {
        const siblings = await storage.getSignSpecs(spec.opportunityId);
        const stillReferenced = siblings.some(
          (s) => s.id !== spec.id && s.logoAssetId === previousLogoAssetId
        );
        if (!stillReferenced) {
          try {
            await storage.deleteAsset(previousLogoAssetId);
          } catch (err: any) {
            logger.warn(`[Upload Logo] Failed to delete old logo asset: ${err?.message || err}`);
          }
        }
      }

      res.json({ asset, spec: { ...spec, logoAssetId: asset.id } });
    }
  );

  app.post("/api/sign-specs/:id/plane", requireAuth, async (req: Request, res: Response) => {
    const spec = await storage.getSignSpec(req.params.id as string);
    if (!spec) return res.status(404).json({ message: "Not found" });
    if (isFullSceneOnly(spec.signType)) {
      return res.status(409).json({ message: "Placement plane not applicable for this sign type" });
    }
    const { points, referenceLine, referenceLengthInches, straightenToRect } = req.body;
    if (!points || !Array.isArray(points) || points.length !== 4) {
      return res.status(400).json({ message: "Exactly 4 points required" });
    }
    const plane = await storage.savePlane({
      opportunityId: spec.opportunityId,
      signSpecId: spec.id,
      points,
      referenceLine: referenceLine ?? null,
      referenceLengthInches: referenceLengthInches ?? null,
      straightenToRect: straightenToRect !== false,
    });
    await storage.deleteOutputsBySignSpec(spec.id);
    res.json(plane);
  });

  app.delete("/api/sign-specs/:id/plane", requireAuth, async (req: Request, res: Response) => {
    const spec = await storage.getSignSpec(req.params.id as string);
    if (!spec) return res.status(404).json({ message: "Not found" });
    await storage.deletePlaneBySignSpec(spec.id);
    await storage.deleteOutputsBySignSpec(spec.id);
    res.json({ ok: true });
  });

  app.delete("/api/sign-specs/:id/photo", requireAuth, async (req: Request, res: Response) => {
    const spec = await storage.getSignSpec(req.params.id as string);
    if (!spec) return res.status(404).json({ message: "Not found" });

    const removedCanvasAssetId = spec.canvasAssetId;
    await storage.updateSignSpec(spec.id, { canvasAssetId: null });
    await storage.deletePlaneBySignSpec(spec.id);

    // Any existing mockups were composited onto the now-removed photo — clear them
    // so the PDF won't show a sign on a photo that no longer exists.
    await storage.deleteOutputsBySignSpec(spec.id);

    // Drop the orphaned CANVAS asset so it can't resurface via the "latest CANVAS"
    // lookup. Only if no sibling spec still references it.
    if (removedCanvasAssetId) {
      const siblings = await storage.getSignSpecs(spec.opportunityId);
      const stillReferenced = siblings.some(
        (s) => s.id !== spec.id && s.canvasAssetId === removedCanvasAssetId
      );
      if (!stillReferenced) {
        try {
          await storage.deleteAsset(removedCanvasAssetId);
        } catch (err: any) {
          logger.warn(`[Clear Photo] Failed to delete canvas asset: ${err?.message || err}`);
        }
      }
    }

    res.json({ ok: true });
  });

  app.delete("/api/sign-specs/:id/logo", requireAuth, async (req: Request, res: Response) => {
    const spec = await storage.getSignSpec(req.params.id as string);
    if (!spec) return res.status(404).json({ message: "Not found" });

    const removedLogoAssetId = spec.logoAssetId;
    await storage.updateSignSpec(spec.id, { logoAssetId: null });
    await storage.deleteOutputsBySignSpec(spec.id);

    if (removedLogoAssetId) {
      const siblings = await storage.getSignSpecs(spec.opportunityId);
      const stillReferenced = siblings.some(
        (s) => s.id !== spec.id && s.logoAssetId === removedLogoAssetId
      );
      if (!stillReferenced) {
        try {
          await storage.deleteAsset(removedLogoAssetId);
        } catch (err: any) {
          logger.warn(`[Clear Logo] Failed to delete logo asset: ${err?.message || err}`);
        }
      }
    }

    res.json({ ok: true });
  });

  app.post("/api/sign-specs/:id/generate", requireAuth, async (req: Request, res: Response) => {
    try {
      const spec = await storage.getSignSpec(req.params.id as string);
      if (!spec) return res.status(404).json({ message: "Sign spec not found" });

      const opp = await storage.getOpportunity(spec.opportunityId);
      if (!opp) return res.status(404).json({ message: "Opportunity not found" });

      const useAI = req.body.useAI !== false;
      const ctx = await buildGenerationContext(spec, opp, {
        useAI,
        userId: req.session.userId,
      });
      const { rule, signTypeData } = ctx;

      if (signTypeData?.showSignCode && !spec.signCodeText && opp.address) {
        try {
          const signCodeText = await lookupSignCode({
            address: opp.address,
            signType: spec.signType,
            signTypeLabel: signTypeData.label,
          });
          await storage.updateSignSpec(spec.id, { signCodeText, showSignCode: true });
          ctx.spec = { ...ctx.spec, signCodeText, showSignCode: true };
        } catch {}
      }

      const tiers = getGenerationTiers(rule);

      await storage.deleteOutputsBySignSpec(spec.id);

      const results = [];
      let aiFailureReason: string | undefined;

      for (const tierInfo of tiers) {
        const result = await generateOutputMockup(ctx, tierInfo);
        if (result.aiFailureReason) aiFailureReason = result.aiFailureReason;

        const output = await storage.createOutput({
          opportunityId: opp.id,
          signSpecId: spec.id,
          tier: tierInfo.tier,
          baselineImageFilename: result.baselinePath ?? null,
          aiMockupFilename: result.aiMockupPath ?? null,
          selectedProducts: tierInfo.products,
          rationaleText: result.rationale,
          complianceText: result.compliance,
          accuracyScoreBaseline: null,
          accuracyScoreAI: null,
          accuracyNotes: null,
        });

        results.push(output);
      }

      res.json({ outputs: results, aiFailureReason });
    } catch (err: any) {
      logger.error("Sign spec generation error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post(
    "/api/opportunities/:id/generate-all-specs",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const opp = await storage.getOpportunity(req.params.id as string);
        if (!opp) return res.status(404).json({ message: "Not found" });

        // biome-ignore lint/style/noNonNullAssertion: requireAuth guarantees userId is set
        const user = await storage.getUser(req.session.userId!);
        if (user?.role === "SUPER_ADMIN") {
        } else if (user?.tenantId && user.tenantId === opp.tenantId) {
        } else if (opp.ownerId === req.session.userId) {
        } else {
          return res.status(403).json({ message: "Access denied" });
        }

        const specs = await storage.getSignSpecs(opp.id);
        if (specs.length === 0)
          return res.status(400).json({ message: "No sign specs to generate" });

        const useAI = req.body.useAI !== false;
        const allResults = [];
        let lastAiFailureReason: string | undefined;
        let generated = 0;
        let skipped = 0;
        let failed = 0;

        for (const spec of specs) {
          const existingOutputs = await storage.getOutputsBySignSpec(spec.id);
          const allHaveMockups =
            existingOutputs.length > 0 && existingOutputs.every((o) => o.aiMockupFilename);
          if (allHaveMockups) {
            allResults.push(...existingOutputs);
            skipped++;
            logger.info(
              `[Generate All Specs] Skipping ${spec.signType} — already has complete outputs`
            );
            continue;
          }

          if (existingOutputs.length > 0) {
            await storage.deleteOutputsBySignSpec(spec.id);
            logger.info(
              `[Generate All Specs] Regenerating ${spec.signType} — previous outputs missing mockups`
            );
          }

          try {
            const ctx = await buildGenerationContext(spec, opp, {
              useAI,
              userId: req.session.userId,
            });
            const { rule, signTypeData } = ctx;

            if (signTypeData?.showSignCode && !spec.signCodeText && opp.address) {
              try {
                const signCodeText = await lookupSignCode({
                  address: opp.address,
                  signType: spec.signType,
                  signTypeLabel: signTypeData.label,
                });
                await storage.updateSignSpec(spec.id, { signCodeText, showSignCode: true });
                ctx.spec = { ...ctx.spec, signCodeText, showSignCode: true };
              } catch {}
            }

            const tiers = getGenerationTiers(rule);

            for (const tierInfo of tiers) {
              const result = await generateOutputMockup(ctx, tierInfo);
              if (result.aiFailureReason) lastAiFailureReason = result.aiFailureReason;

              const output = await storage.createOutput({
                opportunityId: opp.id,
                signSpecId: spec.id,
                tier: tierInfo.tier,
                baselineImageFilename: result.baselinePath ?? null,
                aiMockupFilename: result.aiMockupPath ?? null,
                selectedProducts: tierInfo.products,
                rationaleText: result.rationale,
                complianceText: result.compliance,
                accuracyScoreBaseline: null,
                accuracyScoreAI: null,
                accuracyNotes: null,
              });

              allResults.push(output);
            }

            generated++;
            logger.info(`[Generate All Specs] Completed ${spec.signType}`);
          } catch (err: any) {
            failed++;
            logger.info(`[Generate All Specs] Failed for spec ${spec.signType}: ${err.message}`);
            lastAiFailureReason = err.message;
          }
        }

        res.json({
          outputs: allResults,
          aiFailureReason: lastAiFailureReason,
          totalSpecs: specs.length,
          generated,
          skipped,
          failed,
        });
      } catch (err: any) {
        logger.error("Generate all specs error:", err);
        res.status(500).json({ message: err.message });
      }
    }
  );

  app.post("/api/opportunities/:id/generate", requireAuth, async (req: Request, res: Response) => {
    try {
      let opp = await storage.getOpportunity(req.params.id as string);
      if (!opp) return res.status(404).json({ message: "Not found" });

      const oppAssets = await storage.getAssets(opp.id);
      const planeRaw = await storage.getPlane(opp.id);
      const plane = planeRaw
        ? {
            ...planeRaw,
            points: planeRaw.straightenToRect ? straightenPoints(planeRaw.points) : planeRaw.points,
          }
        : undefined;
      const canvasAsset = latestAssetOfType(oppAssets, "CANVAS");
      const logoAsset = latestAssetOfType(oppAssets, "LOGO");

      const rule = await storage.findRule(
        opp.locationType,
        opp.signType,
        opp.budgetRange,
        opp.tenantId
      );
      const signRefs = await storage.getSignTypeReferences(opp.signType);
      const signTypeData = await storage.getSignTypeByName(opp.signType);

      if (signTypeData?.showSignCode && !opp.signCodeText && opp.address) {
        try {
          logger.info(
            `[Auto Sign Code] Sign type "${opp.signType}" has showSignCode enabled, looking up regulations...`
          );
          const signCodeText = await lookupSignCode({
            address: opp.address,
            signType: opp.signType,
            signTypeLabel: signTypeData.label,
          });
          await storage.updateOpportunity(opp.id, { signCodeText, showSignCode: true });
          opp = { ...opp, signCodeText, showSignCode: true };
          logger.info(`[Auto Sign Code] Regulations saved for "${opp.clientName}"`);
        } catch (err: any) {
          logger.info(`[Auto Sign Code] Lookup failed (non-blocking): ${err.message}`);
        }
      }

      if (signTypeData?.showSignCode && !opp.showSignCode) {
        await storage.updateOpportunity(opp.id, { showSignCode: true });
        opp = { ...opp, showSignCode: true };
      }

      const enabledTiers = rule ? (rule.enabledTiers ?? []) : [];
      const allTiers = [
        {
          tier: "GOOD" as const,
          products: rule?.goodProducts ?? ["Standard Option"],
          tierSignType: rule?.goodSignType || null,
        },
        {
          tier: "BETTER" as const,
          products: rule?.betterProducts ?? ["Enhanced Option"],
          tierSignType: rule?.betterSignType || null,
        },
        {
          tier: "BEST" as const,
          products: rule?.bestProducts ?? ["Premium Option"],
          tierSignType: rule?.bestSignType || null,
        },
      ];
      const tiers =
        enabledTiers.length > 0
          ? allTiers.filter((t) => enabledTiers.includes(t.tier))
          : [{ tier: "GOOD" as const, products: [] as string[], tierSignType: null }];

      await storage.deleteOutputs(opp.id);

      const useAI = req.body.useAI !== false;
      const hasCanvas = !!canvasAsset;
      const hasPlane = !!plane;
      const results = [];
      let aiFailureReason: string | undefined;

      let estimatedDimensionsInches: { width: number; height: number } | null = null;
      if (
        hasPlane &&
        plane.referenceLine &&
        plane.referenceLengthInches &&
        plane.referenceLine.length === 2
      ) {
        const refPixelDist = Math.sqrt(
          (plane.referenceLine[1].x - plane.referenceLine[0].x) ** 2 +
            (plane.referenceLine[1].y - plane.referenceLine[0].y) ** 2
        );
        if (refPixelDist > 0) {
          const pixelsPerInch = refPixelDist / plane.referenceLengthInches;
          const xs = plane.points.map((p: any) => p.x);
          const ys = plane.points.map((p: any) => p.y);
          const planePixelW = Math.max(...xs) - Math.min(...xs);
          const planePixelH = Math.max(...ys) - Math.min(...ys);
          estimatedDimensionsInches = {
            width: planePixelW / pixelsPerInch,
            height: planePixelH / pixelsPerInch,
          };
          logger.info(
            `[Reference Measurement] Estimated sign area: ${Math.round(estimatedDimensionsInches.width)}" × ${Math.round(estimatedDimensionsInches.height)}" (${((estimatedDimensionsInches.width * estimatedDimensionsInches.height) / 144).toFixed(1)} sq ft)`
          );
        }
      }

      const isSingleMockup = enabledTiers.length === 0;

      for (const { tier, products, tierSignType } of tiers) {
        const effectiveSignType = tierSignType || opp.signType;
        const effectiveSignTypeData = tierSignType
          ? await storage.getSignTypeByName(tierSignType)
          : signTypeData;
        const effectiveSignRefs = tierSignType
          ? await storage.getSignTypeReferences(tierSignType)
          : signRefs;
        const approvedExamplesForTier3 = await storage.getApprovedFeedbackImages(
          effectiveSignType,
          2
        );
        const approvedFilenamesForTier3 = approvedExamplesForTier3
          .filter((fb) => fb.generatedFilename)
          .map((fb) => fb.generatedFilename as string);
        const needsWorkForTier3 = await storage.getNeedsWorkSummary(effectiveSignType);
        const improvementGuidanceForTier3 = (() => {
          const parts: string[] = [];
          if (needsWorkForTier3.areas.length > 0)
            parts.push(`Fix these areas: ${needsWorkForTier3.areas.join(", ")}`);
          if (needsWorkForTier3.notes.length > 0)
            parts.push(`Reviewer notes: ${needsWorkForTier3.notes.slice(0, 3).join(" | ")}`);
          return parts.length > 0 ? parts.join(". ") : undefined;
        })();
        const effectiveReferences = selectReferences(effectiveSignRefs, approvedFilenamesForTier3);
        const fewShotExamples = await loadFewShotExamples(effectiveSignType);

        let baselinePath: string | undefined;
        if (hasCanvas && hasPlane) {
          baselinePath = await generateComposite({
            canvasFilename: canvasAsset.filename,
            logoFilename: logoAsset?.filename,
            planePoints: plane.points,
            tier,
            opportunityId: opp.id,
            clientName: opp.clientName,
            signType: effectiveSignType,
          });
        }

        let aiMockupPath: string | undefined;
        if (useAI) {
          try {
            aiMockupPath = await generateGeminiMockup({
              canvasFilename: hasCanvas ? canvasAsset.filename : undefined,
              logoFilename: logoAsset?.filename,
              planePoints: hasPlane ? plane.points : undefined,
              tier: isSingleMockup ? "BETTER" : tier,
              opportunityId: opp.id,
              clientName: opp.clientName,
              signType: effectiveSignType,
              signTypeDescription: effectiveSignTypeData?.description ?? undefined,
              signTypeAttributes: (effectiveSignTypeData?.attributes as string[]) ?? undefined,
              generationNotes: effectiveSignTypeData?.generationNotes ?? undefined,
              samplePrompt: effectiveSignTypeData?.samplePrompt ?? undefined,
              improvementGuidance: improvementGuidanceForTier3,
              userId: req.session.userId,
              tenantId: opp.tenantId,
              promptBox: opp.promptBox,
              selectedProducts: products.length > 0 ? products : undefined,
              references: effectiveReferences.length > 0 ? effectiveReferences : undefined,
              fewShotExamples: fewShotExamples.length > 0 ? fewShotExamples : undefined,
              estimatedDimensionsInches,
              straightenToRect: hasPlane ? (planeRaw?.straightenToRect ?? true) : undefined,
            });
          } catch (err: any) {
            const errStr = typeof err === "object" ? JSON.stringify(err) : String(err);
            const isRateLimit = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED");
            if (isRateLimit) {
              logger.info(`Gemini AI mockup rate limited for ${tier} — retries exhausted`);
              aiFailureReason =
                "Google Gemini AI is temporarily rate-limited due to high usage. This is not an app issue — Gemini limits how many image requests can be made per minute. Please wait about 5 minutes before trying again.";
            } else {
              logger.info(`Gemini AI mockup failed for ${tier}: ${err.message || errStr}`);
              aiFailureReason = `AI mockup generation failed: ${err.message || "Unknown error"}`;
            }
          }
        }

        const rationale = generateRationale({
          opportunity: opp,
          tier,
          selectedProducts: products,
          signTypeLabel: effectiveSignTypeData?.label,
        });
        const compliance = generateComplianceText({
          opportunity: opp,
          signCodeText: opp.signCodeText,
        });

        const output = await storage.createOutput({
          opportunityId: opp.id,
          tier,
          baselineImageFilename: baselinePath ?? null,
          aiMockupFilename: aiMockupPath ?? null,
          selectedProducts: products,
          rationaleText: rationale,
          complianceText: compliance,
          accuracyScoreBaseline: null,
          accuracyScoreAI: null,
          accuracyNotes: null,
        });

        results.push(output);
      }

      res.json({ outputs: results, aiFailureReason });
    } catch (err: any) {
      logger.error("Generation error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post(
    "/api/opportunities/:id/generate-all-sign-types",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const opp = await storage.getOpportunity(req.params.id as string);
        if (!opp) return res.status(404).json({ message: "Not found" });

        const oppAssets = await storage.getAssets(opp.id);
        const planeRaw = await storage.getPlane(opp.id);
        const plane = planeRaw
          ? {
              ...planeRaw,
              points: planeRaw.straightenToRect
                ? straightenPoints(planeRaw.points)
                : planeRaw.points,
            }
          : undefined;
        const canvasAsset = latestAssetOfType(oppAssets, "CANVAS");
        const logoAsset = latestAssetOfType(oppAssets, "LOGO");
        const hasCanvas = !!canvasAsset;
        const hasPlane = !!plane;

        const allSignTypes = await storage.getSignTypes();
        await storage.deleteOutputs(opp.id);

        const results = [];

        for (const st of allSignTypes) {
          const signRefs = await storage.getSignTypeReferences(st.name);
          const effectiveReferences = selectReferences(signRefs, []);
          const fewShotExamples = await loadFewShotExamples(st.name);

          try {
            const aiMockupPath = await generateGeminiMockup({
              canvasFilename: hasCanvas ? canvasAsset?.filename : undefined,
              logoFilename: logoAsset?.filename,
              planePoints: hasPlane ? plane?.points : undefined,
              tier: "BETTER",
              opportunityId: opp.id,
              clientName: opp.clientName,
              signType: st.name,
              signTypeDescription: st.description ?? undefined,
              signTypeAttributes: (st.attributes as string[]) ?? undefined,
              generationNotes: st.generationNotes ?? undefined,
              samplePrompt: st.samplePrompt ?? undefined,
              userId: req.session.userId,
              tenantId: opp.tenantId,
              promptBox: opp.promptBox,
              selectedProducts: [st.label || st.name],
              references: effectiveReferences.length > 0 ? effectiveReferences : undefined,
              fewShotExamples: fewShotExamples.length > 0 ? fewShotExamples : undefined,
              straightenToRect: hasPlane ? (planeRaw?.straightenToRect ?? true) : undefined,
            });

            const output = await storage.createOutput({
              opportunityId: opp.id,
              tier: "BETTER",
              baselineImageFilename: null,
              aiMockupFilename: aiMockupPath ?? null,
              selectedProducts: [st.label || st.name],
              rationaleText: `Test mockup for sign type: ${st.label || st.name} (${st.category || "N/A"}). ${st.description?.substring(0, 200) || ""}`,
              complianceText: `Sign Type: ${st.label || st.name}\nCategory: ${st.category || "N/A"}\nAttributes: ${(st.attributes as string[])?.join(", ") || "None"}`,
              accuracyScoreBaseline: null,
              accuracyScoreAI: null,
              accuracyNotes: null,
            });

            results.push(output);
            logger.info(
              `[Test All] Generated mockup for ${st.name} (${results.length}/${allSignTypes.length})`
            );
          } catch (err: any) {
            logger.info(`[Test All] Skipped ${st.name}: ${err.message}`);
            const output = await storage.createOutput({
              opportunityId: opp.id,
              tier: "BETTER",
              baselineImageFilename: null,
              aiMockupFilename: null,
              selectedProducts: [st.label || st.name],
              rationaleText: `Test mockup FAILED for sign type: ${st.label || st.name}. Error: ${err.message}`,
              complianceText: `Sign Type: ${st.label || st.name}\nCategory: ${st.category || "N/A"}`,
              accuracyScoreBaseline: null,
              accuracyScoreAI: null,
              accuracyNotes: null,
            });
            results.push(output);
          }
        }

        res.json({ outputs: results, totalSignTypes: allSignTypes.length });
      } catch (err: any) {
        logger.error("Test all sign types error:", err);
        res.status(500).json({ message: err.message });
      }
    }
  );
}
