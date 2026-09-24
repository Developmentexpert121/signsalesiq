import type { NextFunction, Request, Response } from "express";
import { storage } from "../storage";

import { logger } from "../logger";
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "SUPER_ADMIN")
      return res.status(403).json({ message: "Super Admin required" });
    next();
  } catch (err: any) {
    logger.error("[requireSuperAdmin] error:", err?.message);
    res.status(500).json({ message: "Auth check failed" });
  }
}

export async function requireTenantAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return res.status(403).json({ message: "Admin required" });
    }
    next();
  } catch (err: any) {
    logger.error("[requireTenantAdmin] error:", err?.message);
    res.status(500).json({ message: "Auth check failed" });
  }
}
