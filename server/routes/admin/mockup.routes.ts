import type { Express, Request, Response } from "express";
import { testSmtpConnection } from "../../emailService";
import { generateGeminiMockup } from "../../geminiMockupService";
import { logger } from "../../logger";
import { requireSuperAdmin } from "../../middleware/requireRole";
import {
  getActiveMockupModel,
  KNOWN_MOCKUP_MODELS,
  setActiveMockupModel,
} from "../../mockup/geminiClient";
import { selectReferences } from "../../mockup/referenceUtils";
import { deleteOutput, deleteUpload, saveUpload } from "../../objectStore";
import { storage } from "../../storage";
import { upload } from "../../upload";
export function registerMockupRoutes(app: Express) {
  app.get("/api/admin/smtp-test", requireSuperAdmin, async (_req: Request, res: Response) => {
    const result = await testSmtpConnection();
    res.status(result.ok ? 200 : 500).json(result);
  });

  app.get("/api/admin/mockup-settings", requireSuperAdmin, async (_req: Request, res: Response) => {
    res.json({ model: getActiveMockupModel(), knownModels: KNOWN_MOCKUP_MODELS });
  });

  app.post("/api/admin/mockup-settings", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const model = typeof req.body?.model === "string" ? req.body.model.trim() : "";
      if (!model) {
        return res.status(400).json({ message: "model is required" });
      }
      const saved = await storage.updateMockupSettings({ model });
      setActiveMockupModel(model);
      logger.info(`[Mockup] Active generation model set to "${model}"`);
      res.json(saved);
    } catch (err: any) {
      logger.error("[Mockup] Failed to update model setting:", err?.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post(
    "/api/admin/test-mockup",
    requireSuperAdmin,
    upload.fields([
      { name: "sitePhoto", maxCount: 1 },
      { name: "logo", maxCount: 1 },
    ]),
    async (req: Request, res: Response) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const sitePhotoFile = files?.sitePhoto?.[0];
        const logoFile = files?.logo?.[0];
        const { prompt, signType, planePoints: planePointsRaw } = req.body;

        if (!signType) {
          return res.status(400).json({ message: "Sign type is required" });
        }

        let planePoints: { x: number; y: number }[] | undefined;
        if (planePointsRaw) {
          try {
            const parsed = JSON.parse(planePointsRaw);
            if (
              Array.isArray(parsed) &&
              parsed.length === 4 &&
              parsed.every((p: any) => typeof p.x === "number" && typeof p.y === "number")
            ) {
              planePoints = parsed;
            }
          } catch {
            // ignore invalid planePoints
          }
        }

        const st = await storage.getSignTypeByName(signType);
        if (!st) {
          return res.status(404).json({ message: `Sign type "${signType}" not found` });
        }

        const signRefs = await storage.getSignTypeReferences(st.name);

        const testId = `__test_${Date.now()}`;

        const approvedExamples = await storage.getApprovedFeedbackImages(st.name, 2);
        const approvedFilenames = approvedExamples
          .filter((fb) => fb.generatedFilename)
          .map((fb) => fb.generatedFilename!);
        const needsWorkForTest = await storage.getNeedsWorkSummary(st.name);
        const improvementGuidanceForTest = (() => {
          const parts: string[] = [];
          if (needsWorkForTest.areas.length > 0)
            parts.push(`Fix these areas: ${needsWorkForTest.areas.join(", ")}`);
          if (needsWorkForTest.notes.length > 0)
            parts.push(`Reviewer notes: ${needsWorkForTest.notes.slice(0, 3).join(" | ")}`);
          return parts.length > 0 ? parts.join(". ") : undefined;
        })();

        const allReferences = selectReferences(signRefs, approvedFilenames);

        const fewShotRows = await storage.getSignTypeExamples(st.name, { limit: 2 });
        const fewShotExamples = fewShotRows.map((r) => ({
          inputText: r.exampleInput,
          outputFilename: r.exampleOutputFilename,
          label: r.label ?? undefined,
        }));

        if (sitePhotoFile) {
          await saveUpload(sitePhotoFile.filename, sitePhotoFile.buffer, sitePhotoFile.mimetype);
        }
        if (logoFile) {
          await saveUpload(logoFile.filename, logoFile.buffer, logoFile.mimetype);
        }

        let outputFilename: string;
        try {
          outputFilename = await generateGeminiMockup({
            canvasFilename: sitePhotoFile?.filename,
            logoFilename: logoFile?.filename,
            planePoints,
            tier: "BETTER",
            opportunityId: testId,
            userId: req.session.userId,
            clientName: prompt || "Test Client",
            signType: st.name,
            signTypeDescription: st.description ?? undefined,
            signTypeAttributes: (st.attributes as string[]) ?? undefined,
            generationNotes: st.generationNotes ?? undefined,
            samplePrompt: st.samplePrompt ?? undefined,
            improvementGuidance: improvementGuidanceForTest,
            promptBox: prompt || null,
            selectedProducts: [st.label || st.name],
            references: allReferences.length > 0 ? allReferences : undefined,
            fewShotExamples: fewShotExamples.length > 0 ? fewShotExamples : undefined,
          });
        } finally {
          if (sitePhotoFile) {
            await deleteUpload(sitePhotoFile.filename).catch(() => {});
          }
          if (logoFile) {
            await deleteUpload(logoFile.filename).catch(() => {});
          }
        }

        const outputRelative = `${testId}/${outputFilename}`;
        const generatedFilename = outputRelative;

        res.json({
          success: true,
          signType: st.label || st.name,
          signTypeName: st.name,
          signTypeCategory: st.category,
          mockupUrl: `/api/files/${outputRelative}`,
          generatedFilename,
          promptUsed: prompt || null,
          referenceCount: allReferences.length,
          approvedExamplesUsed: approvedFilenames.length,
          fewShotCount: fewShotExamples.length,
        });

        setTimeout(
          () => {
            deleteOutput(testId, outputFilename).catch(() => {});
          },
          30 * 60 * 1000
        );
      } catch (err: any) {
        logger.error("Test mockup error:", err);
        res.status(500).json({ message: err.message });
      }
    }
  );

  app.post("/api/admin/mockup-feedback", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const {
        signType,
        signTypeLabel,
        tier,
        promptUsed,
        generatedFilename,
        rating,
        notes,
        improvementAreas,
      } = req.body;
      logger.info(`[Feedback] POST signType=${signType} rating=${rating}`);
      if (!signType || !rating)
        return res.status(400).json({ message: "signType and rating are required" });
      if (!["APPROVED", "NEEDS_WORK"].includes(rating))
        return res.status(400).json({ message: "rating must be APPROVED or NEEDS_WORK" });
      const areas = Array.isArray(improvementAreas) ? improvementAreas : null;
      const fb = await storage.createMockupFeedback({
        signType,
        signTypeLabel: signTypeLabel || signType,
        tier: tier || "BETTER",
        promptUsed: promptUsed || null,
        generatedFilename: generatedFilename || null,
        rating,
        notes: notes || null,
        improvementAreas: areas,
      });
      if (!fb)
        return res.status(500).json({ message: "Failed to save feedback — no record returned" });
      logger.info(`[Feedback] Saved id=${fb.id}`);
      res.json(fb);
    } catch (err: any) {
      logger.error("[Feedback] POST error:", err?.message);
      res.status(500).json({ message: err.message || "Failed to save feedback" });
    }
  });

  app.get("/api/admin/mockup-feedback", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { signType } = req.query;
      const feedback = await storage.getMockupFeedback(signType as string | undefined);
      res.json(feedback);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get(
    "/api/admin/mockup-feedback/stats",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const stats = await storage.getMockupFeedbackStats();
        res.json(stats);
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    }
  );

  app.delete(
    "/api/admin/mockup-feedback/:id",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        await storage.deleteMockupFeedback(req.params.id as string);
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    }
  );
}
