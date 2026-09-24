import bcrypt from "bcrypt";
import type { Express, Request, Response } from "express";
import { requireTenantAdmin } from "../../middleware/requireRole";
import { sendUserWelcomeEmail } from "../../emailService";
import { storage } from "../../storage";

export function registerUserRoutes(app: Express) {
  app.get(
    "/api/tenants/:tenantId/users",
    requireTenantAdmin,
    async (req: Request, res: Response) => {
      const currentUser = await storage.getUser(req.session.userId!);
      const tenantId = req.params.tenantId as string;

      if (currentUser?.role === "ADMIN" && currentUser.tenantId !== tenantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const tenantUsers = await storage.getUsersByTenant(tenantId);
      const safeUsers = tenantUsers.map((u) => {
        const { passwordHash, ...safe } = u;
        return safe;
      });
      res.json(safeUsers);
    }
  );

  app.post(
    "/api/tenants/:tenantId/users",
    requireTenantAdmin,
    async (req: Request, res: Response) => {
      const currentUser = await storage.getUser(req.session.userId!);
      const tenantId = req.params.tenantId as string;

      if (currentUser?.role === "ADMIN" && currentUser.tenantId !== tenantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { name, email, password, role, phone } = req.body;
      if (!name || !email || !password)
        return res.status(400).json({ message: "Name, email, and password required" });

      const allowedRole =
        currentUser?.role === "SUPER_ADMIN"
          ? role || "SALES"
          : role && role !== "SUPER_ADMIN"
            ? role
            : "SALES";
      if (currentUser?.role === "ADMIN" && role === "SUPER_ADMIN") {
        return res.status(403).json({ message: "Cannot create super admin users" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser)
        return res.status(400).json({ message: "A user with that email already exists" });

      const passwordHash = await bcrypt.hash(password, 12);
      const newUser = await storage.createUser({
        name,
        email,
        phone,
        passwordHash,
        role: allowedRole as any,
        tenantId,
      });

      const tenantInfo = await storage.getTenant(tenantId);
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const companyLogoUrl = tenantInfo?.logoFilename
        ? `${baseUrl}/api/uploads/${tenantInfo.logoFilename}`
        : null;
      sendUserWelcomeEmail({
        name,
        email,
        tempPassword: password,
        companyName: tenantInfo?.name || "Your Organization",
        role: allowedRole,
        companyWebsite: tenantInfo?.website || null,
        companyLogoUrl,
      });

      const { passwordHash: _, ...safe } = newUser;
      res.json(safe);
    }
  );

  app.patch("/api/users/:id", requireTenantAdmin, async (req: Request, res: Response) => {
    const currentUser = await storage.getUser(req.session.userId!);
    const targetUser = await storage.getUser(req.params.id as string);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    if (currentUser?.role === "ADMIN" && currentUser.tenantId !== targetUser.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updates: any = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.email) updates.email = req.body.email;
    if (req.body.phone !== undefined) updates.phone = req.body.phone;
    if (req.body.role && currentUser?.role === "SUPER_ADMIN") updates.role = req.body.role;
    if (req.body.role && currentUser?.role === "ADMIN") {
      if (req.body.role !== "SUPER_ADMIN") updates.role = req.body.role;
    }
    if (req.body.password) {
      updates.passwordHash = await bcrypt.hash(req.body.password, 12);
    }

    const updated = await storage.updateUser(targetUser.id, updates);
    if (!updated) return res.status(404).json({ message: "Update failed" });
    const { passwordHash, ...safe } = updated;
    res.json(safe);
  });

  app.delete("/api/users/:id", requireTenantAdmin, async (req: Request, res: Response) => {
    const currentUser = await storage.getUser(req.session.userId!);
    const targetUser = await storage.getUser(req.params.id as string);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    if (targetUser.id === currentUser?.id) {
      return res.status(400).json({ message: "Cannot delete yourself" });
    }

    if (currentUser?.role === "ADMIN" && currentUser.tenantId !== targetUser.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (targetUser.role === "SUPER_ADMIN" && currentUser?.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Cannot delete super admin" });
    }

    await storage.deleteUser(targetUser.id);
    res.json({ ok: true });
  });
}
