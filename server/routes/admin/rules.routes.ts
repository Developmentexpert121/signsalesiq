import type { Express, Request, Response } from "express";
import { requireSuperAdmin, requireTenantAdmin } from "../../middleware/requireRole";
import { storage } from "../../storage";

export function registerRulesRoutes(app: Express) {
  app.get("/api/admin/rules", requireSuperAdmin, async (_req: Request, res: Response) => {
    const rules = await storage.getGlobalRules();
    res.json(rules);
  });

  app.get("/api/admin/rules-public", requireTenantAdmin, async (_req: Request, res: Response) => {
    const rules = await storage.getGlobalRules();
    res.json(rules);
  });

  app.post("/api/admin/rules", requireSuperAdmin, async (req: Request, res: Response) => {
    const rule = await storage.createRule({ ...req.body, tenantId: null });
    res.json(rule);
  });

  app.patch("/api/admin/rules/:id", requireSuperAdmin, async (req: Request, res: Response) => {
    const rule = await storage.updateRule(req.params.id as string, req.body);
    if (!rule) return res.status(404).json({ message: "Not found" });
    res.json(rule);
  });

  app.delete("/api/admin/rules/:id", requireSuperAdmin, async (req: Request, res: Response) => {
    await storage.deleteRule(req.params.id as string);
    res.json({ ok: true });
  });

  app.get("/api/tenant/rules", requireTenantAdmin, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role === "SUPER_ADMIN") {
      const rules = await storage.getGlobalRules();
      return res.json(rules);
    }
    if (!user.tenantId) return res.status(400).json({ message: "No tenant assigned" });
    const tenantRules = await storage.getRulesByTenant(user.tenantId);
    res.json(tenantRules);
  });

  app.get("/api/tenant/rules/merged", requireTenantAdmin, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (!user.tenantId) return res.status(400).json({ message: "No tenant assigned" });
    const globalRules = await storage.getGlobalRules();
    const tenantRules = await storage.getRulesByTenant(user.tenantId);

    const merged = globalRules.map((gr) => {
      const override = tenantRules.find(
        (tr) =>
          tr.locationType === gr.locationType &&
          tr.signType === gr.signType &&
          tr.budgetRange === gr.budgetRange
      );
      if (override) {
        return { ...override, _globalRuleId: gr.id, _isOverride: true, _globalRule: gr };
      }
      return { ...gr, _globalRuleId: gr.id, _isOverride: false, _active: true };
    });

    const customRules = tenantRules
      .filter(
        (tr) =>
          !globalRules.some(
            (gr) =>
              gr.locationType === tr.locationType &&
              gr.signType === tr.signType &&
              gr.budgetRange === tr.budgetRange
          )
      )
      .map((tr) => ({ ...tr, _globalRuleId: null, _isOverride: false }));

    res.json([...merged, ...customRules]);
  });

  app.post("/api/tenant/rules/copy", requireTenantAdmin, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user || !user.tenantId) return res.status(400).json({ message: "No tenant assigned" });
    const { globalRuleId } = req.body;
    const globalRule = await storage.getRule(globalRuleId);
    if (!globalRule || globalRule.tenantId !== null)
      return res.status(400).json({ message: "Not a global rule" });

    const existingOverrides = await storage.getRulesByTenant(user.tenantId);
    const existing = existingOverrides.find(
      (r) =>
        r.locationType === globalRule.locationType &&
        r.signType === globalRule.signType &&
        r.budgetRange === globalRule.budgetRange
    );

    if (existing) {
      return res.status(400).json({ message: "You already have a custom version of this rule" });
    }

    const copied = await storage.createRule({
      tenantId: user.tenantId,
      locationType: globalRule.locationType,
      signType: globalRule.signType,
      budgetRange: globalRule.budgetRange,
      enabledTiers: globalRule.enabledTiers,
      goodSignType: globalRule.goodSignType,
      betterSignType: globalRule.betterSignType,
      bestSignType: globalRule.bestSignType,
      goodProducts: globalRule.goodProducts,
      betterProducts: globalRule.betterProducts,
      bestProducts: globalRule.bestProducts,
    });
    res.json(copied);
  });

  app.post("/api/tenant/rules", requireTenantAdmin, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user || !user.tenantId) return res.status(400).json({ message: "No tenant assigned" });
    const rule = await storage.createRule({ ...req.body, tenantId: user.tenantId });
    res.json(rule);
  });

  app.patch("/api/tenant/rules/:id", requireTenantAdmin, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const existing = await storage.getRule(req.params.id as string);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (user.role !== "SUPER_ADMIN" && existing.tenantId !== user.tenantId) {
      return res.status(403).json({ message: "Cannot modify rules from another tenant" });
    }
    const { tenantId, ...updateData } = req.body;
    const rule = await storage.updateRule(req.params.id as string, updateData);
    res.json(rule);
  });

  app.delete("/api/tenant/rules/:id", requireTenantAdmin, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const existing = await storage.getRule(req.params.id as string);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (user.role !== "SUPER_ADMIN" && existing.tenantId !== user.tenantId) {
      return res.status(403).json({ message: "Cannot delete rules from another tenant" });
    }
    await storage.deleteRule(req.params.id as string);
    res.json({ ok: true });
  });
}
