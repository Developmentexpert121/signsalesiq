import type { Express, Request, Response } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { requireSuperAdmin as requireSuperAdminRole } from "../../middleware/requireRole";
import { upload } from "../../upload";
import { isUnsupportedVectorFile } from "../../fileConvert";
import { saveUpload } from "../../objectStore";
import { storage } from "../../storage";

export function registerSignTypeRoutes(app: Express) {
  app.get("/api/sign-types", requireAuth, async (_req: Request, res: Response) => {
    const types = await storage.getSignTypes();
    res.json(types);
  });

  app.get("/api/sign-type-references", requireAuth, async (_req: Request, res: Response) => {
    const refs = await storage.getAllSignTypeReferences();
    res.json(refs);
  });

  app.get("/api/admin/sign-types", requireSuperAdminRole, async (_req: Request, res: Response) => {
    const types = await storage.getSignTypes();
    res.json(types);
  });

  app.post("/api/admin/sign-types", requireSuperAdminRole, async (req: Request, res: Response) => {
    const { name, label, category, description, attributes, sortOrder, active } = req.body;
    if (!name || !label) return res.status(400).json({ message: "Name and label are required" });
    const existing = await storage.getSignTypeByName(name);
    if (existing)
      return res.status(400).json({ message: "A sign type with that name already exists" });
    const st = await storage.createSignType({
      name,
      label,
      category: category || "INTERIOR",
      description: description || null,
      attributes: attributes || [],
      sortOrder: sortOrder ?? 0,
      active: active !== false,
    });

    try {
      await storage.createRule({
        locationType: (category || "INTERIOR") as any,
        signType: name,
        budgetRange: "0_500" as any,
        goodProducts: ["Standard Option"],
        betterProducts: ["Enhanced Option"],
        bestProducts: ["Premium Option"],
        enabledTiers: ["GOOD"],
        tenantId: null,
      } as any);
    } catch (e) {
      // non-critical
    }

    res.json(st);
  });

  app.patch(
    "/api/admin/sign-types/:id",
    requireSuperAdminRole,
    async (req: Request, res: Response) => {
      // `name` is the foreign-key string referenced by sign_specs, opportunities,
      // product_rules, sign_type_references, sign_type_examples and mockup_feedback.
      // Renaming it would orphan all of those rows (the PDF/UI label lookup would
      // then fall back to a formatted raw name). Treat name/id as immutable identity;
      // label, category, description, showSignCode, etc. remain freely editable.
      const updates = { ...(req.body ?? {}) };
      delete updates.name;
      delete updates.id;
      const st = await storage.updateSignType(req.params.id as string, updates);
      if (!st) return res.status(404).json({ message: "Sign type not found" });
      res.json(st);
    }
  );

  app.delete(
    "/api/admin/sign-types/:id",
    requireSuperAdminRole,
    async (req: Request, res: Response) => {
      await storage.deleteSignType(req.params.id as string);
      res.json({ ok: true });
    }
  );

  app.get("/api/admin/references", requireSuperAdminRole, async (_req: Request, res: Response) => {
    const refs = await storage.getAllSignTypeReferences();
    res.json(refs);
  });

  app.get(
    "/api/admin/references/:signType",
    requireSuperAdminRole,
    async (req: Request, res: Response) => {
      const refs = await storage.getSignTypeReferences(req.params.signType as string);
      res.json(refs);
    }
  );

  app.post(
    "/api/admin/references",
    requireSuperAdminRole,
    upload.array("files", 100),
    async (req: Request, res: Response) => {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0)
        return res.status(400).json({ message: "At least one file required" });
      const { signType, label } = req.body;
      const results = [];
      const skipped: string[] = [];
      for (const file of files) {
        if (isUnsupportedVectorFile(file.originalname)) {
          skipped.push(file.originalname);
          continue;
        }
        await saveUpload(file.filename, file.buffer, file.mimetype);
        const ref = await storage.createSignTypeReference({
          signType,
          filename: file.filename,
          mimeType: file.mimetype,
          label: label || null,
          isPrimary: false,
        });
        results.push(ref);
      }
      res.json({ created: results, skipped });
    }
  );

  app.patch(
    "/api/admin/references/:id",
    requireSuperAdminRole,
    async (req: Request, res: Response) => {
      const ref = await storage.updateSignTypeReference(req.params.id as string, req.body);
      if (!ref) return res.status(404).json({ message: "Not found" });
      res.json(ref);
    }
  );

  app.delete(
    "/api/admin/references/:id",
    requireSuperAdminRole,
    async (req: Request, res: Response) => {
      await storage.deleteSignTypeReference(req.params.id as string);
      res.json({ ok: true });
    }
  );

  // Curated few-shot examples per sign type. Each row pairs a textual input spec
  // with an accepted output image; the mockup service injects up to two pairs
  // before the [SIGN REFERENCES] block to calibrate the model.
  app.get(
    "/api/admin/sign-type-examples",
    requireSuperAdminRole,
    async (_req: Request, res: Response) => {
      const rows = await storage.getAllSignTypeExamples();
      res.json(rows);
    }
  );

  app.get(
    "/api/admin/sign-type-examples/:signType",
    requireSuperAdminRole,
    async (req: Request, res: Response) => {
      const rows = await storage.getSignTypeExamples(req.params.signType as string);
      res.json(rows);
    }
  );

  app.post(
    "/api/admin/sign-type-examples",
    requireSuperAdminRole,
    upload.single("file"),
    async (req: Request, res: Response) => {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ message: "File required" });
      const { signType, exampleInput, label, sortOrder } = req.body;
      if (!signType || !exampleInput) {
        return res.status(400).json({ message: "signType and exampleInput are required" });
      }
      if (isUnsupportedVectorFile(file.originalname)) {
        return res.status(400).json({ message: "Unsupported file type" });
      }
      await saveUpload(file.filename, file.buffer, file.mimetype);
      const row = await storage.createSignTypeExample({
        signType,
        exampleInput,
        exampleOutputFilename: file.filename,
        mimeType: file.mimetype,
        label: label || null,
        sortOrder: sortOrder != null ? Number(sortOrder) : 0,
        active: true,
      });
      res.json(row);
    }
  );

  app.patch(
    "/api/admin/sign-type-examples/:id",
    requireSuperAdminRole,
    async (req: Request, res: Response) => {
      const row = await storage.updateSignTypeExample(req.params.id as string, req.body);
      if (!row) return res.status(404).json({ message: "Not found" });
      res.json(row);
    }
  );

  app.delete(
    "/api/admin/sign-type-examples/:id",
    requireSuperAdminRole,
    async (req: Request, res: Response) => {
      await storage.deleteSignTypeExample(req.params.id as string);
      res.json({ ok: true });
    }
  );
}
