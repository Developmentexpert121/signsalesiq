import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

export const validate =
  (schemas: { body?: ZodSchema; params?: ZodSchema; query?: ZodSchema }) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params) as any;
      if (schemas.query) req.query = schemas.query.parse(req.query) as any;
      next();
    } catch (e: any) {
      res.status(400).json({ message: "Invalid request", errors: e.issues ?? e.message });
    }
  };
