import type { Express, Request, Response } from "express";
import { requireSuperAdmin } from "../../middleware/requireRole";
import { storage } from "../../storage";

export function registerEmailTemplateRoutes(app: Express) {
  app.get("/api/admin/email-templates", requireSuperAdmin, async (_req: Request, res: Response) => {
    const templates = await storage.getEmailTemplates();
    res.json(templates);
  });

  app.get(
    "/api/admin/email-templates/:id",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      const template = await storage.getEmailTemplate(req.params.id as string);
      if (!template) return res.status(404).json({ message: "Template not found" });
      res.json(template);
    }
  );

  app.patch(
    "/api/admin/email-templates/:id",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      const { subject, bodyHtml, name, active } = req.body;
      if (subject !== undefined && typeof subject !== "string")
        return res.status(400).json({ message: "Subject must be a string" });
      if (bodyHtml !== undefined && typeof bodyHtml !== "string")
        return res.status(400).json({ message: "Body HTML must be a string" });
      if (name !== undefined && typeof name !== "string")
        return res.status(400).json({ message: "Name must be a string" });
      if (active !== undefined && typeof active !== "boolean")
        return res.status(400).json({ message: "Active must be a boolean" });
      const updated = await storage.updateEmailTemplate(req.params.id as string, {
        ...(subject !== undefined && { subject }),
        ...(bodyHtml !== undefined && { bodyHtml }),
        ...(name !== undefined && { name }),
        ...(active !== undefined && { active }),
      });
      if (!updated) return res.status(404).json({ message: "Template not found" });
      res.json(updated);
    }
  );

  app.get("/api/admin/email-logs", requireSuperAdmin, async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
    const logs = await storage.getEmailLogs(limit);
    res.json(logs);
  });
}
