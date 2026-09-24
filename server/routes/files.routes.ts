import type { Express, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getObject, outputKey, uploadKey } from "../cloudStorage";
import { storage } from "../storage";

function pipeObject(
  res: Response,
  obj: { stream: NodeJS.ReadableStream; contentType?: string }
): void {
  if (obj.contentType) res.setHeader("Content-Type", obj.contentType);
  obj.stream.on("error", () => {
    if (!res.headersSent) res.status(500).end();
  });
  obj.stream.pipe(res);
}

export function registerFileRoutes(app: Express) {
  app.get("/api/uploads/:filename", requireAuth, async (req: Request, res: Response) => {
    const filename = req.params.filename as string;
    if (/[/\\]|\.\./.test(filename)) {
      return res.status(400).json({ message: "Invalid filename" });
    }

    const obj = await getObject(uploadKey(filename));
    if (!obj) return res.status(404).json({ message: "File not found" });

    pipeObject(res, obj);
  });

  app.get("/api/files/:oppId/:filename", requireAuth, async (req: Request, res: Response) => {
    const oppId = req.params.oppId as string;
    const filename = req.params.filename as string;

    if (/[/\\]|\.\./.test(filename) || /[\\]|\.\./.test(oppId)) {
      return res.status(400).json({ message: "Invalid filename" });
    }

    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // Admin test-mockup outputs use a synthetic `__test_<ts>` id (no opportunity row).
    const isAdminTest = oppId.startsWith("__test_") && user.role === "SUPER_ADMIN";
    if (!isAdminTest) {
      const opp = await storage.getOpportunity(oppId);
      if (!opp) return res.status(404).json({ message: "Not found" });
      if (user.role !== "SUPER_ADMIN" && opp.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Not found" });
      }
    }

    const obj = await getObject(outputKey(oppId, filename));
    if (!obj) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(404).json({ message: "Not found" });
    }

    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    pipeObject(res, obj);
  });
}
