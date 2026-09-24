import { mockupIssueByKey } from "@shared/mockupIssueOptions";
import type { Express, Request, Response } from "express";
import { logActivity, resolveActorFields } from "../activityLogger";
import { logger } from "../logger";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import { buildGenerationContext, generateOutputMockup } from "../mockupGenerationService";
import { storage } from "../storage";
import { type OutputFeedbackBody, outputFeedbackBodySchema } from "../validators/outputFeedback";

// Outputs with a regeneration currently running. Prevents a double-submit from
// racing two regenerations onto the same output row (single-instance deployment).
const inFlightRegens = new Set<string>();

export function registerOutputFeedbackRoutes(app: Express) {
  // Instance-scoped feedback on one generated mockup, optionally triggering an
  // in-place regeneration of just that output. The selected issues + free text
  // are injected into the regeneration prompt as one-off correction guidance;
  // they deliberately do NOT enter the global per-sign-type learning system.
  app.post(
    "/api/outputs/:id/feedback",
    requireAuth,
    validate({ body: outputFeedbackBodySchema }),
    async (req: Request, res: Response) => {
      try {
        const { issues, notes, regenerate } = req.body as OutputFeedbackBody;

        const output = await storage.getOutput(req.params.id as string);
        if (!output) return res.status(404).json({ message: "Output not found" });

        const opp = await storage.getOpportunity(output.opportunityId);
        if (!opp) return res.status(404).json({ message: "Opportunity not found" });

        const userId = req.session.userId;
        const user = userId ? await storage.getUser(userId) : undefined;
        if (user?.role === "SUPER_ADMIN") {
        } else if (user?.tenantId && user.tenantId === opp.tenantId) {
        } else if (opp.ownerId === req.session.userId) {
        } else {
          return res.status(403).json({ message: "Access denied" });
        }

        const spec = output.signSpecId
          ? await storage.getSignSpec(output.signSpecId)
          : undefined;
        const signType = spec?.signType ?? opp.signType;

        if (regenerate && (!output.signSpecId || !spec)) {
          return res.status(422).json({ message: "This mockup can't be regenerated individually" });
        }
        if (regenerate && inFlightRegens.has(output.id)) {
          return res
            .status(409)
            .json({ message: "A regeneration is already running for this mockup" });
        }

        const feedback = await storage.createOutputFeedback({
          outputId: output.id,
          opportunityId: output.opportunityId,
          signSpecId: output.signSpecId,
          userId: req.session.userId ?? null,
          tenantId: opp.tenantId ?? null,
          tier: output.tier,
          signType,
          issueKeys: issues,
          freeText: notes ?? null,
          flaggedMockupFilename: output.aiMockupFilename ?? output.baselineImageFilename,
          regenerationRequested: regenerate,
          regenerationSucceeded: null,
        });

        logActivity({
          action: "mockup_feedback_submitted",
          provider: "internal",
          status: "success",
          ...(await resolveActorFields(req.session.userId, opp.tenantId)),
          metadata: { outputId: output.id, tier: output.tier, signType, issues, regenerate },
        });

        if (!regenerate || !spec) return res.json({ feedback });

        inFlightRegens.add(output.id);
        try {
          const hints = issues
            .map((k) => mockupIssueByKey.get(k)?.promptHint)
            .filter((h): h is string => !!h);
          const parts: string[] = [];
          if (hints.length > 0)
            parts.push(
              `The user flagged these problems on the previous attempt — fix every one: ${hints.join(" ")}`
            );
          if (notes) parts.push(`User's description of the problem: "${notes}"`);
          const instanceImprovementGuidance = parts.join(" ") || undefined;

          const ctx = await buildGenerationContext(spec, opp, {
            useAI: true,
            userId: req.session.userId,
          });
          const result = await generateOutputMockup(
            ctx,
            { tier: output.tier, products: output.selectedProducts, tierSignType: null },
            { instanceImprovementGuidance, skipBaseline: true }
          );

          let updated = output;
          if (result.aiMockupPath) {
            const row = await storage.updateOutput(output.id, {
              aiMockupFilename: result.aiMockupPath,
              accuracyScoreAI: null,
            });
            if (!row) {
              return res
                .status(409)
                .json({ message: "Mockup was replaced — refresh and try again" });
            }
            updated = row;
          }

          await storage.updateOutputFeedback(feedback.id, {
            regenerationSucceeded: !!result.aiMockupPath,
          });

          res.json({ feedback, output: updated, aiFailureReason: result.aiFailureReason });
        } finally {
          inFlightRegens.delete(output.id);
        }
      } catch (err: any) {
        logger.error({ err }, "Output feedback error");
        res.status(500).json({ message: err.message });
      }
    }
  );
}
