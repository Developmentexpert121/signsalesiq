import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { upload } from "../upload";
import { saveUpload } from "../objectStore";
import {
  sendOpportunityCreatedEmail,
  sendOpportunityStatusEmail,
  sendProposalPdfEmail,
} from "../emailService";
import { generateProposalPDF } from "../pdfService";
import { getAI, lookupSignCode } from "../signCodeService";
import { latestAssetOfType, storage } from "../storage";
import { db } from "../db";
import { opportunities, signSpecs, ownerSubscriptions, type SignSpec } from "@shared/schema";
import {
  hasGenerationContextChanged,
  planSignSpecReconciliation,
} from "../signSpecIsolation";

import { logger } from "../logger";
class PlanLimitError extends Error {
  constructor(limit: number) {
    super(
      `You've reached your plan limit of ${limit} opportunities. Please upgrade your plan to create more.`
    );
    this.name = "PlanLimitError";
  }
}

export function registerOpportunityRoutes(app: Express) {
  app.get("/api/opportunities", requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "User not found" });

    const limitParam = req.query.limit as string | undefined;
    const cursor = req.query.cursor as string | undefined;

    if (limitParam !== undefined) {
      const limit = Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200);
      let result;
      if (user.role === "SUPER_ADMIN") {
        result = await storage.getOpportunitiesPaginated({ limit, cursor });
      } else if (user.tenantId) {
        result = await storage.getOpportunitiesPaginated({
          tenantId: user.tenantId,
          limit,
          cursor,
        });
      } else {
        result = await storage.getOpportunitiesPaginated({
          ownerId: req.session.userId!,
          limit,
          cursor,
        });
      }
      return res.json(result);
    }

    // Legacy: no limit param — return full list (backward compat for existing frontend)
    let opps;
    if (user.role === "SUPER_ADMIN") {
      opps = await storage.getOpportunities();
    } else if (user.tenantId) {
      opps = await storage.getOpportunitiesByTenant(user.tenantId);
    } else {
      opps = await storage.getOpportunities(req.session.userId);
    }

    logger.info(
      { userId: user.id, role: user.role, tenant: user.tenantId, count: opps.length },
      "fetched opportunities"
    );
    res.json(opps);
  });

  app.get("/api/opportunities/:id", requireAuth, async (req: Request, res: Response) => {
    const opp = await storage.getOpportunity(req.params.id as string);
    if (!opp) return res.status(404).json({ message: "Not found" });

    const user = await storage.getUser(req.session.userId!);
    if (user?.role === "SUPER_ADMIN") {
    } else if (user?.tenantId && user.tenantId === opp.tenantId) {
    } else if (opp.ownerId === req.session.userId) {
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    const [oppAssets, plane, oppOutputs, oppSignSpecs, oppPlanes] = await Promise.all([
      storage.getAssets(opp.id),
      storage.getPlane(opp.id),
      storage.getOutputs(opp.id),
      storage.getSignSpecs(opp.id),
      storage.getPlanesByOpportunity(opp.id),
    ]);

    res.json({
      opportunity: opp,
      assets: oppAssets,
      plane,
      planes: oppPlanes,
      outputs: oppOutputs,
      signSpecs: oppSignSpecs,
    });
  });

  app.post("/api/opportunities", requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    const { signSpecs: specsList, ...oppData } = req.body;

    let opp;
    try {
      opp = await db.transaction(async (tx) => {
        // Plan-limit check + atomic usage increment (SELECT FOR UPDATE prevents race)
        if (user?.tenantId) {
          const settings = await storage.getSubscriptionSettings();
          if (settings?.subscriptionGateEnabled) {
            const ownerSub = await storage.getOwnerSubscription(user.tenantId);
            if (ownerSub?.planId && ownerSub?.status === "active") {
              const plan = await storage.getSubscriptionPlan(ownerSub.planId);
              if (plan) {
                const locked = await tx.execute(sql`
                  SELECT events_used FROM owner_subscriptions
                  WHERE tenant_id = ${user.tenantId}
                  FOR UPDATE
                `);
                const currentUsage = (locked.rows[0] as any)?.events_used ?? 0;
                if (currentUsage >= plan.eventLimit) {
                  throw new PlanLimitError(plan.eventLimit);
                }
              }
            }
          }
        }

        // Create opportunity
        const [newOpp] = await tx
          .insert(opportunities)
          .values({
            ...oppData,
            ownerId: req.session.userId!,
            tenantId: user?.tenantId || null,
          })
          .returning();

        // Create sign specs
        if (Array.isArray(specsList) && specsList.length > 0) {
          await tx.insert(signSpecs).values(
            specsList.map((specData: any, i: number) => ({
              opportunityId: newOpp.id,
              signType: specData.signType,
              locationType: specData.locationType,
              budgetRange: specData.budgetRange,
              signDuration: specData.signDuration,
              targetAudience: specData.targetAudience,
              showSignCode: specData.showSignCode,
              promptBox: specData.promptBox || null,
              sortOrder: specData.sortOrder ?? i,
            }))
          );
        }

        // Atomic usage increment
        if (user?.tenantId) {
          await tx.execute(sql`
            UPDATE owner_subscriptions
            SET events_used = events_used + 1
            WHERE tenant_id = ${user.tenantId}
          `);
        }

        return newOpp;
      });
    } catch (err: any) {
      if (err instanceof PlanLimitError) {
        return res.status(403).json({ message: err.message, limitReached: true });
      }
      logger.error("[CreateOpportunity] transaction error:", err);
      return res.status(500).json({ message: err.message || "Failed to create opportunity" });
    }

    if (user) {
      sendOpportunityCreatedEmail(
        user.email,
        user.name,
        opp.clientName,
        opp.address || "",
        user.name
      );
    }

    res.json(opp);
  });

  app.patch("/api/opportunities/:id", requireAuth, async (req: Request, res: Response) => {
    const existing = await storage.getOpportunity(req.params.id as string);
    if (!existing) return res.status(404).json({ message: "Not found" });

    const user = await storage.getUser(req.session.userId!);
    if (user?.role === "SUPER_ADMIN") {
    } else if (user?.role === "ADMIN" && user.tenantId === existing.tenantId) {
    } else if (existing.ownerId === req.session.userId) {
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    const { signSpecs: specsList, ...oppData } = req.body;
    let existingSpecs: SignSpec[] = [];
    let reconciliation:
      | ReturnType<typeof planSignSpecReconciliation<Record<string, any>>>
      | undefined;
    if (Array.isArray(specsList)) {
      existingSpecs = await storage.getSignSpecs(req.params.id as string);
      try {
        reconciliation = planSignSpecReconciliation(existingSpecs, specsList);
      } catch (err: any) {
        return res.status(400).json({ message: err.message });
      }
    }

    const opp = await storage.updateOpportunity(req.params.id as string, oppData);
    if (!opp) return res.status(404).json({ message: "Not found" });

    if (Array.isArray(specsList)) {
      if (!reconciliation) {
        return res.status(400).json({ message: "Invalid sign spec payload" });
      }
      const buildUpdates = (specData: Record<string, any>, index: number) => ({
        signType: specData.signType,
        locationType: specData.locationType,
        budgetRange: specData.budgetRange,
        signDuration: specData.signDuration,
        targetAudience: specData.targetAudience,
        showSignCode: specData.showSignCode,
        promptBox: specData.promptBox || null,
        sortOrder: index,
      });

      for (const { existing: existingSpec, submitted: specData, index } of
        reconciliation.existingUpdates) {
        const updates = buildUpdates(specData, index);
        await storage.updateSignSpec(existingSpec.id, updates);
        if (hasGenerationContextChanged(existingSpec, updates)) {
          await storage.deleteOutputsBySignSpec(existingSpec.id);
        }
      }

      for (const { submitted: specData, index } of reconciliation.newSpecs) {
        const updates = buildUpdates(specData, index);
        await storage.createSignSpec({
          opportunityId: req.params.id as string,
          ...updates,
        });
      }

      for (const existingSpec of reconciliation.deletedSpecs) {
        await storage.deleteSignSpec(existingSpec.id);
      }
    }

    if (
      oppData.status &&
      (oppData.status === "WON" || oppData.status === "LOST") &&
      oppData.status !== existing.status
    ) {
      const owner = existing.ownerId ? await storage.getUser(existing.ownerId) : null;
      if (owner) {
        sendOpportunityStatusEmail(owner.email, owner.name, opp?.clientName, oppData.status);
      }
    }

    res.json(opp);
  });

  app.delete("/api/opportunities/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getOpportunity(req.params.id as string);
      if (!existing) return res.status(404).json({ message: "Not found" });

      const user = await storage.getUser(req.session.userId!);
      if (user?.role === "SUPER_ADMIN") {
      } else if (user?.role === "ADMIN" && user.tenantId === existing.tenantId) {
      } else if (existing.ownerId === req.session.userId) {
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteOpportunity(req.params.id as string);
      res.json({ ok: true });
    } catch (err: any) {
      logger.error("Delete opportunity error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post(
    "/api/opportunities/:id/assets",
    requireAuth,
    upload.single("file"),
    async (req: Request, res: Response) => {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const { convertToPng, isConvertibleFile, isUnsupportedVectorFile } = await import(
        "../fileConvert"
      );
      const sharp = (await import("sharp")).default;
      const type = req.body.type as "CANVAS" | "LOGO";
      if (!["CANVAS", "LOGO"].includes(type))
        return res.status(400).json({ message: "Invalid type" });

      if (isUnsupportedVectorFile(req.file.originalname)) {
        return res.status(400).json({
          message:
            "This file format (.ai, .cdr, .dxf, .eps) is not supported. Please export your file as PNG, JPG, SVG, or PDF and upload again.",
        });
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
          const meta = await sharp(req.file.buffer).metadata();
          width = meta.width;
          height = meta.height;
        } catch {}
      }

      await saveUpload(finalFilename, finalBuffer, finalMimeType);

      await storage.deleteAssetsByType(req.params.id as string, type);

      const asset = await storage.createAsset({
        opportunityId: req.params.id as string,
        type,
        filename: finalFilename,
        mimeType: finalMimeType,
        width: width ?? null,
        height: height ?? null,
      });

      res.json(asset);
    }
  );

  app.post("/api/opportunities/:id/plane", requireAuth, async (req: Request, res: Response) => {
    const { points, referenceLine, referenceLengthInches, signSpecId, straightenToRect } = req.body;
    if (!points || !Array.isArray(points) || points.length !== 4) {
      return res.status(400).json({ message: "Exactly 4 points required" });
    }
    const plane = await storage.savePlane({
      opportunityId: req.params.id as string,
      signSpecId: signSpecId ?? null,
      points,
      referenceLine: referenceLine ?? null,
      referenceLengthInches: referenceLengthInches ?? null,
      straightenToRect: straightenToRect !== false,
    });
    res.json(plane);
  });

  app.delete("/api/opportunities/:id/plane", requireAuth, async (req: Request, res: Response) => {
    await storage.deletePlaneByOpportunity(req.params.id as string);
    res.json({ ok: true });
  });

  app.post("/api/opportunities/:id/sign-code", requireAuth, async (req: Request, res: Response) => {
    try {
      const opp = await storage.getOpportunity(req.params.id as string);
      if (!opp) return res.status(404).json({ message: "Not found" });

      const user = await storage.getUser(req.session.userId!);
      if (user?.role === "SUPER_ADMIN") {
      } else if (user?.role === "ADMIN" && user.tenantId === opp.tenantId) {
      } else if (opp.ownerId === req.session.userId) {
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      const specs = await storage.getSignSpecs(opp.id);
      const specsWithSignCode = specs.filter((s) => s.showSignCode);
      const signTypeNames = new Set<string>();
      if (opp.showSignCode) signTypeNames.add(opp.signType);
      for (const s of specsWithSignCode) signTypeNames.add(s.signType);
      if (signTypeNames.size === 0) signTypeNames.add(opp.signType);

      const signTypeLabels: string[] = [];
      for (const st of Array.from(signTypeNames)) {
        const stData = await storage.getSignTypeByName(st);
        signTypeLabels.push(stData?.label || st);
      }

      const signCodeText = await lookupSignCode({
        address: opp.address,
        signType: Array.from(signTypeNames).join(", "),
        signTypeLabel: signTypeLabels.join(", "),
      });

      const updated = await storage.updateOpportunity(opp.id, { signCodeText });
      res.json({ signCodeText, opportunity: updated });
    } catch (err: any) {
      logger.error("Sign code lookup error:", err);
      const status = err.message?.includes("not configured") ? 503 : 500;
      res.status(status).json({ message: err.message });
    }
  });

  app.patch("/api/outputs/:id", requireAuth, async (req: Request, res: Response) => {
    const output = await storage.updateOutput(req.params.id as string, req.body);
    if (!output) return res.status(404).json({ message: "Not found" });
    res.json(output);
  });

  app.post("/api/outputs/:id/polish-notes", requireAuth, async (req: Request, res: Response) => {
    try {
      const { notes } = req.body;
      if (!notes || typeof notes !== "string" || !notes.trim()) {
        return res.status(400).json({ message: "Notes text is required" });
      }

      const ai = getAI();
      if (!ai) {
        return res.status(500).json({ message: "No AI API key configured for this environment" });
      }

      const prompt = `You are a professional signage sales proposal writer. Take the following rough project notes and rewrite them into a polished, professional project description suitable for a client-facing proposal. Keep all the key details but improve the language, grammar, and flow. Keep it concise (2-4 sentences). Do not add information that isn't in the original notes. Return ONLY the polished text, no explanations or labels.\n\nOriginal notes:\n${notes.trim()}`;

      let lastErr: any;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          });
          const polishedText = response.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!polishedText) {
            return res.status(500).json({ message: "AI did not return polished text" });
          }
          return res.json({ polishedText: polishedText.trim() });
        } catch (err: any) {
          lastErr = err;
          const errStr = String(err?.message || err);
          if (errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED")) {
            return res.status(429).json({
              message:
                "Google Gemini AI is temporarily rate-limited. Please wait about 5 minutes before trying again.",
            });
          }
          if (attempt < 3) {
            logger.warn(`[PolishNotes] Attempt ${attempt} failed: ${errStr} — retrying...`);
            await new Promise((r) => setTimeout(r, attempt * 1500));
          }
        }
      }
      logger.error("[PolishNotes] All attempts failed:", lastErr?.message || lastErr);
      res.status(500).json({ message: "Failed to polish notes with AI" });
    } catch (err: any) {
      logger.error("[PolishNotes] Unexpected error:", err?.message || err);
      res.status(500).json({ message: "Failed to polish notes with AI" });
    }
  });

  app.post(
    "/api/opportunities/:id/export-pdf",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const opp = await storage.getOpportunity(req.params.id as string);
        if (!opp) return res.status(404).json({ message: "Not found" });

        const { signSpecId } = (req.body || {}) as { signSpecId?: string };

        const allOutputs = await storage.getOutputs(opp.id);
        const allSpecs = await storage.getSignSpecs(opp.id);
        const assets = await storage.getAssets(opp.id);
        const canvasAsset = latestAssetOfType(assets, "CANVAS");

        const allSignTypes = await storage.getSignTypes();
        const signTypeLabels: Record<string, string> = {};
        const signTypeShowCode: Record<string, boolean> = {};
        for (const st of allSignTypes) {
          signTypeLabels[st.name] = st.label;
          signTypeShowCode[st.name] = !!st.showSignCode;
        }

        const currentUser = await storage.getUser(req.session.userId!);
        const tenant = currentUser?.tenantId
          ? await storage.getTenant(currentUser.tenantId)
          : undefined;

        let oppOutputs = allOutputs;
        let specs = allSpecs;
        let signTypeLabel: string | undefined;

        if (signSpecId) {
          const targetSpec = allSpecs.find((s) => s.id === signSpecId);
          if (!targetSpec) return res.status(404).json({ message: "Sign spec not found" });
          specs = [targetSpec];
          oppOutputs = allOutputs.filter((o) => o.signSpecId === signSpecId);
          signTypeLabel = signTypeLabels[targetSpec.signType] || targetSpec.signType;
        } else {
          const stData = await storage.getSignTypeByName(opp.signType);
          signTypeLabel = stData?.label;
        }

        const { filename: pdfFilename } = await generateProposalPDF({
          opportunity: opp,
          outputs: oppOutputs,
          signTypeLabel,
          tenant: tenant || undefined,
          salesperson: currentUser
            ? { name: currentUser.name, email: currentUser.email, phone: currentUser.phone }
            : undefined,
          canvasFilename: canvasAsset?.filename,
          signSpecs: specs,
          signTypeLabels,
          signTypeShowCode,
          assets,
        });

        await storage.createExport({ opportunityId: opp.id, pdfFilename });

        res.json({ filename: pdfFilename, path: pdfFilename });
      } catch (err: any) {
        logger.error("[EXPORT-PDF] ERROR:", err?.message, err?.stack);
        res.status(500).json({ message: err?.message || "PDF export failed" });
      }
    }
  );

  app.post(
    "/api/opportunities/:id/send-email-pdf",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const opp = await storage.getOpportunity(req.params.id as string);
        if (!opp) return res.status(404).json({ message: "Not found" });
        if (!opp.email)
          return res
            .status(400)
            .json({ message: "This opportunity has no email address. Please add one in Edit." });

        const oppOutputs = await storage.getOutputs(opp.id);
        if (oppOutputs.length === 0)
          return res.status(400).json({ message: "No AI mockups yet. Generate a mockup first." });

        const specs = await storage.getSignSpecs(opp.id);
        const assets = await storage.getAssets(opp.id);
        const canvasAsset = latestAssetOfType(assets, "CANVAS");
        const allSignTypes = await storage.getSignTypes();
        const signTypeLabels: Record<string, string> = {};
        const signTypeShowCode: Record<string, boolean> = {};
        for (const st of allSignTypes) {
          signTypeLabels[st.name] = st.label;
          signTypeShowCode[st.name] = !!st.showSignCode;
        }

        const currentUser = await storage.getUser(req.session.userId!);
        const tenant = currentUser?.tenantId
          ? await storage.getTenant(currentUser.tenantId)
          : undefined;
        const stData = await storage.getSignTypeByName(opp.signType);

        const { buffer: pdfBuffer } = await generateProposalPDF({
          opportunity: opp,
          outputs: oppOutputs,
          signTypeLabel: stData?.label,
          tenant: tenant || undefined,
          salesperson: currentUser
            ? { name: currentUser.name, email: currentUser.email, phone: currentUser.phone }
            : undefined,
          canvasFilename: canvasAsset?.filename,
          signSpecs: specs,
          signTypeLabels,
          signTypeShowCode,
          assets,
        });
        const result = await sendProposalPdfEmail(
          opp.email,
          opp.clientName,
          opp.clientName,
          currentUser?.name || "SignSalesIQ",
          pdfBuffer,
          currentUser?.email || undefined
        );

        if (!result.success) {
          return res.status(500).json({ message: result.error || "Failed to send email" });
        }

        res.json({ ok: true, sentTo: opp.email });
      } catch (err: any) {
        logger.error("Send email PDF error:", err);
        res.status(500).json({ message: err.message });
      }
    }
  );
}
