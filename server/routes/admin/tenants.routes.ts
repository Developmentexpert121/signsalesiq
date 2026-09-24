import bcrypt from "bcrypt";
import type { Express, Request, Response } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { requireSuperAdmin, requireTenantAdmin } from "../../middleware/requireRole";
import { upload } from "../../upload";
import { convertToPng, isConvertibleFile } from "../../fileConvert";
import { saveUpload } from "../../objectStore";
import { sendAdminWelcomeEmail } from "../../emailService";
import { storage } from "../../storage";

import { logger } from "../../logger";
export function registerTenantRoutes(app: Express) {
  app.get("/api/tenants", requireSuperAdmin, async (_req: Request, res: Response) => {
    const allTenants = await storage.getTenants();
    const tenantsWithCounts = await Promise.all(
      allTenants.map(async (t) => {
        const users = await storage.getUsersByTenant(t.id);
        const ownerAdmin = users.find((u) => u.role === "ADMIN" || u.role === "SUPER_ADMIN");
        return {
          ...t,
          userCount: users.length,
          ownerAdminName: ownerAdmin?.name ?? null,
          ownerAdminEmail: ownerAdmin?.email ?? null,
        };
      })
    );
    res.json(tenantsWithCounts);
  });

  app.post("/api/tenants", requireSuperAdmin, async (req: Request, res: Response) => {
    const { name, slug, phone, email, address, website, adminName, adminEmail, adminPassword } =
      req.body;
    if (!name || !slug) return res.status(400).json({ message: "Name and slug required" });
    if (!adminName || !adminEmail || !adminPassword)
      return res.status(400).json({ message: "Owner admin name, email, and password required" });
    if (adminPassword.length < 8)
      return res.status(400).json({ message: "Admin password must be at least 8 characters" });
    const existing = await storage.getTenantBySlug(slug);
    if (existing)
      return res.status(400).json({ message: "An owner with that slug already exists" });
    const existingUser = await storage.getUserByEmail(adminEmail);
    if (existingUser)
      return res.status(400).json({ message: "A user with that email already exists" });
    const tenant = await storage.createTenant({
      name,
      slug,
      phone,
      email,
      address,
      website,
      active: true,
    });
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await storage.createUser({
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      tenantId: tenant.id,
    });
    sendAdminWelcomeEmail(adminName, adminEmail, adminPassword, name);
    res.json(tenant);
  });

  app.patch("/api/tenants/:id", requireSuperAdmin, async (req: Request, res: Response) => {
    const tenant = await storage.updateTenant(req.params.id as string, req.body);
    if (!tenant) return res.status(404).json({ message: "Not found" });
    res.json(tenant);
  });

  app.delete("/api/tenants/:id", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const tenant = await storage.getTenant(req.params.id as string);
      if (!tenant) return res.status(404).json({ message: "Owner not found" });
      if (tenant.active) {
        return res
          .status(400)
          .json({ message: "Please deactivate this owner account before deleting it." });
      }
      await storage.deleteTenant(req.params.id as string);
      res.json({ ok: true });
    } catch (err: any) {
      logger.error("[Delete Tenant Error]", err);
      res.status(500).json({ message: err.message || "Failed to delete owner" });
    }
  });

  app.post(
    "/api/tenants/:id/logo",
    requireSuperAdmin,
    upload.single("file"),
    async (req: Request, res: Response) => {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      let filename = req.file.filename;
      let buffer = req.file.buffer;
      let mime = req.file.mimetype;
      if (isConvertibleFile(req.file.originalname)) {
        const result = await convertToPng(req.file.buffer, req.file.originalname);
        filename = result.filename;
        buffer = result.buffer;
        mime = "image/png";
      }
      await saveUpload(filename, buffer, mime);
      const tenant = await storage.updateTenant(req.params.id as string, {
        logoFilename: filename,
      });
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });
      res.json(tenant);
    }
  );

  app.post(
    "/api/tenants/:id/template",
    requireTenantAdmin,
    upload.single("file"),
    async (req: Request, res: Response) => {
      const currentUser = await storage.getUser(req.session.userId!);
      const tenantId = req.params.id as string;
      if (currentUser?.role === "ADMIN" && currentUser.tenantId !== tenantId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (currentUser?.role !== "SUPER_ADMIN" && currentUser?.role !== "ADMIN") {
        return res.status(403).json({ message: "Access denied" });
      }
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      await saveUpload(req.file.filename, req.file.buffer, req.file.mimetype);
      const tenant = await storage.updateTenant(tenantId, {
        pdfTemplateFilename: req.file.filename,
      });
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });
      res.json(tenant);
    }
  );

  app.get("/api/tenant/profile", requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user?.tenantId) return res.status(404).json({ message: "No tenant assigned" });
    const tenant = await storage.getTenant(user.tenantId);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    res.json(tenant);
  });

  app.patch("/api/tenant/profile", requireTenantAdmin, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user?.tenantId) return res.status(404).json({ message: "No tenant assigned" });
    const {
      name,
      phone,
      address,
      website,
      email,
      pdfHeaderText,
      pdfFooterText,
      pdfBannerText,
      pdfPrimaryColor,
      pdfAccentColor,
      onboardingComplete,
    } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (website !== undefined) updates.website = website;
    if (email !== undefined) updates.email = email;
    if (pdfHeaderText !== undefined) updates.pdfHeaderText = pdfHeaderText;
    if (pdfFooterText !== undefined) updates.pdfFooterText = pdfFooterText;
    if (pdfBannerText !== undefined) updates.pdfBannerText = pdfBannerText;
    if (pdfPrimaryColor !== undefined) updates.pdfPrimaryColor = pdfPrimaryColor;
    if (pdfAccentColor !== undefined) updates.pdfAccentColor = pdfAccentColor;
    if (onboardingComplete !== undefined) updates.onboardingComplete = onboardingComplete;
    const tenant = await storage.updateTenant(user.tenantId, updates);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    res.json(tenant);
  });

  app.post(
    "/api/tenant/profile/logo",
    requireTenantAdmin,
    upload.single("file"),
    async (req: Request, res: Response) => {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.tenantId) return res.status(404).json({ message: "No tenant assigned" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      let filename = req.file.filename;
      let buffer = req.file.buffer;
      let mime = req.file.mimetype;
      if (isConvertibleFile(req.file.originalname)) {
        const result = await convertToPng(req.file.buffer, req.file.originalname);
        filename = result.filename;
        buffer = result.buffer;
        mime = "image/png";
      }
      await saveUpload(filename, buffer, mime);
      const tenant = await storage.updateTenant(user.tenantId, { logoFilename: filename });
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });
      res.json(tenant);
    }
  );

  app.post(
    "/api/tenant/profile/template",
    requireTenantAdmin,
    upload.single("file"),
    async (req: Request, res: Response) => {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.tenantId) return res.status(404).json({ message: "No tenant assigned" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      await saveUpload(req.file.filename, req.file.buffer, req.file.mimetype);
      const tenant = await storage.updateTenant(user.tenantId, {
        pdfTemplateFilename: req.file.filename,
      });
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });
      res.json(tenant);
    }
  );
}
