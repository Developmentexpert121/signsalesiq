import { randomBytes } from "crypto";
import type { Express, Request, Response } from "express";

import {
  deleteObject,
  getObject,
  isObjectStorageConfigured,
  putObject,
  uploadKey,
} from "../../cloudStorage";
import { env } from "../../env";
import { logger } from "../../logger";
import { requireSuperAdmin } from "../../middleware/requireRole";

function describeError(err: any) {
  return {
    name: err?.name ?? "Error",
    message: err?.message ?? String(err),
    httpStatus: err?.$metadata?.httpStatusCode,
    requestId: err?.$metadata?.requestId,
    cause: err?.cause?.message,
  };
}

export function registerStorageRoutes(app: Express) {
  app.get(
    "/api/admin/storage/diagnose",
    requireSuperAdmin,
    async (_req: Request, res: Response) => {
      const config = {
        objectStorageConfigured: isObjectStorageConfigured,
        doSpaces: {
          configured: !!(
            env.DO_SPACES_KEY &&
            env.DO_SPACES_SECRET &&
            env.DO_SPACES_ENDPOINT &&
            env.DO_SPACES_BUCKET
          ),
          endpoint: env.DO_SPACES_ENDPOINT ?? null,
          region: env.DO_SPACES_REGION ?? null,
          bucket: env.DO_SPACES_BUCKET ?? null,
          keyPrefix: env.DO_SPACES_KEY ? `${env.DO_SPACES_KEY.slice(0, 4)}…` : null,
        },
        replit: {
          configured: !!(env.REPL_ID && env.DEFAULT_OBJECT_STORAGE_BUCKET_ID),
          bucketId: env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? null,
        },
      };

      if (!isObjectStorageConfigured) {
        return res.status(500).json({
          ok: false,
          stage: "config",
          error: { message: "No object storage provider configured" },
          config,
        });
      }

      const filename = `__diag/${randomBytes(8).toString("hex")}.bin`;
      const key = uploadKey(filename);
      const payload = randomBytes(16);

      try {
        const putOk = await putObject(key, payload, "application/octet-stream");
        if (!putOk) {
          return res.status(500).json({
            ok: false,
            stage: "put",
            error: { message: "putObject returned false with no thrown error" },
            config,
          });
        }
      } catch (err: any) {
        logger.error(`[Storage diagnose] put failed: ${err.message}`);
        return res.status(500).json({
          ok: false,
          stage: "put",
          error: describeError(err),
          config,
        });
      }

      try {
        const obj = await getObject(key);
        if (!obj) {
          return res.status(500).json({
            ok: false,
            stage: "get",
            error: { message: "Object not found immediately after put" },
            config,
          });
        }
      } catch (err: any) {
        logger.error(`[Storage diagnose] get failed: ${err.message}`);
        return res.status(500).json({
          ok: false,
          stage: "get",
          error: describeError(err),
          config,
        });
      }

      try {
        await deleteObject(key);
      } catch (err: any) {
        logger.error(`[Storage diagnose] delete failed: ${err.message}`);
        return res.status(500).json({
          ok: false,
          stage: "delete",
          error: describeError(err),
          config,
        });
      }

      return res.json({ ok: true, key, config });
    }
  );
}
