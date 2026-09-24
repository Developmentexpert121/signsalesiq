import type { NextFunction, Request, Response } from "express";
import { storage } from "../storage";

import { logger } from "../logger";
/**
 * Asserts that the route param `paramName` resolves to a row owned by the
 * requesting user's tenant. Stashes the loaded row on `req.resource`.
 * Returns 404 (not 403) on mismatch so we don't leak existence.
 */
export const requireTenantOwned =
  <T extends { tenantId: string | null | undefined }>(
    loader: (id: string) => Promise<T | null | undefined>,
    paramName = "id"
  ) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params[paramName] as string | undefined;
      if (!id) return res.status(400).json({ message: "Missing resource id" });

      if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const row = await loader(id);
      if (!row) return res.status(404).json({ message: "Not found" });

      if (user.role !== "SUPER_ADMIN" && row.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Not found" });
      }

      (req as any).resource = row;
      next();
    } catch (err: any) {
      logger.error("[requireTenantOwned] error:", err?.message);
      res.status(500).json({ message: "Internal server error" });
    }
  };
