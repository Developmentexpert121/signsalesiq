import type { Express } from "express";
import { pool } from "../db";
import { env } from "../env";

export function registerHealthRoutes(app: Express) {
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ ok: true, sha: env.GIT_SHA ?? null });
    } catch {
      res.status(503).json({ ok: false });
    }
  });
}
