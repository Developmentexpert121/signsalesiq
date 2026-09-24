import type { Express, Request, Response } from "express";
import { requireSuperAdmin, requireTenantAdmin } from "../../middleware/requireRole";
import { storage } from "../../storage";
import { pool } from "../../db";

import { logger } from "../../logger";
export function registerUsageRoutes(app: Express) {
  app.get("/api/admin/usage", requireTenantAdmin, async (req: Request, res: Response) => {
    try {
      const requestUser = await storage.getUser(req.session.userId!);
      if (!requestUser) return res.status(401).json({ message: "Unauthorized" });

      const isSuperAdmin = requestUser.role === "SUPER_ADMIN";
      const tenantFilter = isSuperAdmin ? null : requestUser.tenantId;

      const { rows } = await pool.query(
        `
        SELECT
          u.id as user_id,
          u.email as username,
          u.name as user_name,
          u.email,
          u.role,
          u.created_at as user_created_at,
          t.id as tenant_id,
          t.name as tenant_name,
          COUNT(DISTINCT o.id) as opportunities_count,
          COUNT(DISTINCT out.id) as mockups_count,
          COUNT(DISTINCT CASE WHEN out.firefly_image_filename IS NOT NULL THEN out.id END) as ai_mockups_count,
          COUNT(DISTINCT e.id) as exports_count,
          COUNT(DISTINCT a.id) as assets_count,
          MAX(o.created_at) as last_opportunity_at,
          MAX(out.created_at) as last_mockup_at,
          MAX(e.created_at) as last_export_at
        FROM users u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        LEFT JOIN opportunities o ON o.owner_id = u.id
        LEFT JOIN outputs out ON out.opportunity_id = o.id
        LEFT JOIN exports e ON e.opportunity_id = o.id
        LEFT JOIN assets a ON a.opportunity_id = o.id
        ${tenantFilter ? `WHERE u.tenant_id = $1` : ""}
        GROUP BY u.id, u.email, u.name, u.role, u.created_at, t.id, t.name
        ORDER BY t.name NULLS LAST, u.name
      `,
        tenantFilter ? [tenantFilter] : []
      );

      const tenantTotalsQuery = await pool.query(
        `
        SELECT
          t.id as tenant_id,
          t.name as tenant_name,
          COUNT(DISTINCT u.id) as user_count,
          COUNT(DISTINCT o.id) as opportunities_count,
          COUNT(DISTINCT out.id) as mockups_count,
          COUNT(DISTINCT e.id) as exports_count
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id
        LEFT JOIN opportunities o ON o.tenant_id = t.id
        LEFT JOIN outputs out ON out.opportunity_id = o.id
        LEFT JOIN exports e ON e.opportunity_id = o.id
        ${tenantFilter ? `WHERE t.id = $1` : ""}
        GROUP BY t.id, t.name
        ORDER BY t.name
      `,
        tenantFilter ? [tenantFilter] : []
      );

      res.json({
        users: rows,
        tenants: tenantTotalsQuery.rows,
      });
    } catch (err: any) {
      logger.error("Usage endpoint error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/activity", requireTenantAdmin, async (req: Request, res: Response) => {
    try {
      const requestUser = await storage.getUser(req.session.userId!);
      if (!requestUser) return res.status(401).json({ message: "Unauthorized" });

      const isSuperAdmin = requestUser.role === "SUPER_ADMIN";
      const tenantFilter = isSuperAdmin ? null : requestUser.tenantId;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const { rows } = await pool.query(
        `
        (
          SELECT
            'opportunity_created' as action,
            o.created_at as timestamp,
            u.id as user_id,
            u.email as username,
            u.name as user_name,
            t.name as tenant_name,
            o.id as resource_id,
            o.client_name as detail,
            o.sign_type as extra
          FROM opportunities o
          JOIN users u ON o.owner_id = u.id
          LEFT JOIN tenants t ON o.tenant_id = t.id
          ${tenantFilter ? "WHERE o.tenant_id = $3" : ""}
        )
        UNION ALL
        (
          SELECT
            'opportunity_updated' as action,
            o.updated_at as timestamp,
            u.id as user_id,
            u.email as username,
            u.name as user_name,
            t.name as tenant_name,
            o.id as resource_id,
            o.client_name as detail,
            o.sign_type as extra
          FROM opportunities o
          JOIN users u ON o.owner_id = u.id
          LEFT JOIN tenants t ON o.tenant_id = t.id
          WHERE o.updated_at IS NOT NULL AND o.updated_at != o.created_at
          ${tenantFilter ? "AND o.tenant_id = $3" : ""}
        )
        UNION ALL
        (
          SELECT
            'mockup_generated' as action,
            out.created_at as timestamp,
            u.id as user_id,
            u.email as username,
            u.name as user_name,
            t.name as tenant_name,
            out.id as resource_id,
            o.client_name as detail,
            out.tier::text as extra
          FROM outputs out
          JOIN opportunities o ON out.opportunity_id = o.id
          JOIN users u ON o.owner_id = u.id
          LEFT JOIN tenants t ON o.tenant_id = t.id
          ${tenantFilter ? "WHERE o.tenant_id = $3" : ""}
        )
        UNION ALL
        (
          SELECT
            'pdf_exported' as action,
            e.created_at as timestamp,
            u.id as user_id,
            u.email as username,
            u.name as user_name,
            t.name as tenant_name,
            e.id as resource_id,
            o.client_name as detail,
            e.pdf_filename as extra
          FROM exports e
          JOIN opportunities o ON e.opportunity_id = o.id
          JOIN users u ON o.owner_id = u.id
          LEFT JOIN tenants t ON o.tenant_id = t.id
          ${tenantFilter ? "WHERE o.tenant_id = $3" : ""}
        )
        UNION ALL
        (
          SELECT
            'asset_uploaded' as action,
            a.created_at as timestamp,
            u.id as user_id,
            u.email as username,
            u.name as user_name,
            t.name as tenant_name,
            a.id as resource_id,
            o.client_name as detail,
            a.type::text as extra
          FROM assets a
          JOIN opportunities o ON a.opportunity_id = o.id
          JOIN users u ON o.owner_id = u.id
          LEFT JOIN tenants t ON o.tenant_id = t.id
          ${tenantFilter ? "WHERE o.tenant_id = $3" : ""}
        )
        ORDER BY timestamp DESC
        LIMIT $1 OFFSET $2
      `,
        tenantFilter ? [limit, offset, tenantFilter] : [limit, offset]
      );

      res.json({ activities: rows });
    } catch (err: any) {
      logger.error("Activity endpoint error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/activity-logs", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
      const offset = parseInt(req.query.offset as string, 10) || 0;
      const [logs, total] = await Promise.all([
        storage.getActivityLogs(limit, offset),
        storage.getActivityLogCount(),
      ]);
      res.json({ logs, total, limit, offset });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
