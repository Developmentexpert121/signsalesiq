import fs from "fs";
import path from "path";
import { Readable } from "stream";
import {
  doSpacesDeleteObject,
  doSpacesDownload,
  doSpacesGetObject,
  doSpacesUpload,
  doSpacesUploadBuffer,
  isDoSpacesConfigured,
} from "./doSpacesStorage";
import { env } from "./env";

import { logger } from "./logger";
const isReplitEnv = !!env.REPL_ID;
const BUCKET_ID = env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
const useReplitStorage = isReplitEnv && !!BUCKET_ID;
const useDoSpaces = isDoSpacesConfigured;

let replitBucket: any = null;
//test
function getReplitBucket() {
  if (!useReplitStorage) return null;
  if (!replitBucket) {
    try {
      const { objectStorageClient } = require("./replit_integrations/object_storage");
      replitBucket = objectStorageClient.bucket(BUCKET_ID!);
    } catch (err: any) {
      logger.warn(`[CloudStorage] Replit storage init failed: ${err.message}`);
      return null;
    }
  }
  return replitBucket;
}

if (!useReplitStorage && !useDoSpaces) {
  logger.warn("[CloudStorage] No cloud storage configured - file persistence disabled.");
} else {
  const providers = [];
  if (useReplitStorage) providers.push("Replit Object Storage");
  if (useDoSpaces) providers.push("DO Spaces");
  logger.info(`[CloudStorage] Using: ${providers.join(" + ")}`);
}

export async function uploadToCloud(localPath: string, cloudKey: string): Promise<boolean> {
  if (!fs.existsSync(localPath)) return false;

  let uploaded = false;

  if (useDoSpaces) {
    try {
      uploaded = await doSpacesUpload(localPath, cloudKey);
    } catch (err: any) {
      logger.error(`[CloudStorage] DO Spaces upload failed for ${cloudKey}: ${err.message}`);
    }
  }

  if (useReplitStorage) {
    try {
      const bucket = getReplitBucket();
      if (bucket) {
        const destination = `.private/${cloudKey}`;
        await bucket.upload(localPath, { destination });
        uploaded = true;
      }
    } catch (err: any) {
      logger.error(`[CloudStorage] Replit upload failed for ${cloudKey}: ${err.message}`);
    }
  }

  return uploaded;
}

// Deduplication lock: if multiple concurrent requests need the same file from cloud,
// they all share one download promise instead of each starting their own download.
const _downloadInFlight = new Map<string, Promise<boolean>>();

export async function downloadFromCloud(cloudKey: string, localPath: string): Promise<boolean> {
  // If a download for this exact local path is already in progress, wait for it.
  const inflight = _downloadInFlight.get(localPath);
  if (inflight) return inflight;

  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const promise = (async (): Promise<boolean> => {
    if (useDoSpaces) {
      try {
        const ok = await doSpacesDownload(cloudKey, localPath);
        if (ok) return true;
      } catch (err: any) {
        logger.error(`[CloudStorage] DO Spaces download failed for ${cloudKey}: ${err.message}`);
      }
    }

    if (useReplitStorage) {
      try {
        const bucket = getReplitBucket();
        if (bucket) {
          const source = `.private/${cloudKey}`;
          const file = bucket.file(source);
          const [exists] = await file.exists();
          if (exists) {
            await file.download({ destination: localPath });
            return true;
          }
        }
      } catch (err: any) {
        logger.error(`[CloudStorage] Replit download failed for ${cloudKey}: ${err.message}`);
      }
    }

    return false;
  })().finally(() => {
    _downloadInFlight.delete(localPath);
  });

  _downloadInFlight.set(localPath, promise);
  return promise;
}

export async function syncUploadToCloud(filename: string, uploadsDir: string): Promise<void> {
  const localPath = path.join(uploadsDir, filename);
  await uploadToCloud(localPath, `uploads/${filename}`);
}

export async function syncOutputToCloud(
  oppId: string,
  filename: string,
  outputsDir: string
): Promise<void> {
  const localPath = path.join(outputsDir, oppId, filename);
  await uploadToCloud(localPath, `outputs/${oppId}/${filename}`);
}

export async function resolveUploadFromCloud(
  filename: string,
  uploadsDir: string
): Promise<string | null> {
  const localPath = path.join(uploadsDir, filename);
  const ok = await downloadFromCloud(`uploads/${filename}`, localPath);
  return ok ? localPath : null;
}

export async function resolveOutputFromCloud(
  oppId: string,
  filename: string,
  outputsDir: string
): Promise<string | null> {
  const localDir = path.join(outputsDir, oppId);
  if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
  const localPath = path.join(localDir, filename);
  const ok = await downloadFromCloud(`outputs/${oppId}/${filename}`, localPath);
  return ok ? localPath : null;
}

// --- Authoritative object-storage API (buffer-based, no local disk) ---

export const isObjectStorageConfigured = useDoSpaces || useReplitStorage;

export function assertObjectStorageConfigured(): void {
  if (!isObjectStorageConfigured) {
    throw new Error(
      "[CloudStorage] Object storage is required but not configured. " +
        "Set DO_SPACES_* env vars or run with Replit object storage."
    );
  }
}

export function uploadKey(filename: string): string {
  return `uploads/${filename}`;
}

export function outputKey(oppId: string, filename: string): string {
  return `outputs/${oppId}/${filename}`;
}

export async function putObject(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<boolean> {
  let ok = false;
  const errors: Error[] = [];

  if (useDoSpaces) {
    try {
      ok = (await doSpacesUploadBuffer(buffer, key, contentType)) || ok;
    } catch (err: any) {
      logger.error(`[CloudStorage] DO Spaces putObject failed for ${key}: ${err.message}`);
      errors.push(err);
    }
  }

  if (useReplitStorage) {
    try {
      const bucket = getReplitBucket();
      if (bucket) {
        await bucket.file(`.private/${key}`).save(buffer, { contentType, resumable: false });
        ok = true;
      }
    } catch (err: any) {
      logger.error(`[CloudStorage] Replit putObject failed for ${key}: ${err.message}`);
      errors.push(err);
    }
  }

  if (!ok && errors.length > 0) {
    const combined = errors.map((e) => `${e.name ?? "Error"}: ${e.message}`).join(" | ");
    const wrapped = new Error(combined);
    (wrapped as any).cause = errors[0];
    throw wrapped;
  }

  return ok;
}

export async function getObject(
  key: string
): Promise<{ stream: Readable; contentType?: string } | null> {
  if (useDoSpaces) {
    try {
      const r = await doSpacesGetObject(key);
      if (r) return { stream: r.body, contentType: r.contentType };
    } catch (err: any) {
      logger.error(`[CloudStorage] DO Spaces getObject failed for ${key}: ${err.message}`);
    }
  }

  if (useReplitStorage) {
    try {
      const bucket = getReplitBucket();
      if (bucket) {
        const file = bucket.file(`.private/${key}`);
        const [exists] = await file.exists();
        if (exists) {
          const [metadata] = await file.getMetadata();
          return {
            stream: file.createReadStream() as unknown as Readable,
            contentType: metadata.contentType,
          };
        }
      }
    } catch (err: any) {
      logger.error(`[CloudStorage] Replit getObject failed for ${key}: ${err.message}`);
    }
  }

  return null;
}

export async function deleteObject(key: string): Promise<void> {
  if (useDoSpaces) {
    await doSpacesDeleteObject(key);
  }

  if (useReplitStorage) {
    try {
      const bucket = getReplitBucket();
      if (bucket) {
        await bucket.file(`.private/${key}`).delete({ ignoreNotFound: true });
      }
    } catch (err: any) {
      logger.error(`[CloudStorage] Replit deleteObject failed for ${key}: ${err.message}`);
    }
  }
}
