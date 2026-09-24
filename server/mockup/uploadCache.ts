import fs from "fs";
import os from "os";
import path from "path";
import { loadUpload } from "../objectStore";

/**
 * Object storage is authoritative. The internal pipeline below is heavily
 * path-based (sharp .toFile, pdftoppm-style helpers, fileToBase64), so uploads
 * are materialized into a transient OS-temp cache on demand. This is a cache,
 * not canonical storage — the source of truth is object storage.
 */
export const UPLOAD_CACHE_DIR = path.join(os.tmpdir(), "ssiq-upload-cache");

export async function resolveUploadFileAsync(filename: string): Promise<string | null> {
  if (!filename) return null;
  const safeName = path.basename(filename);
  const cachedPath = path.join(UPLOAD_CACHE_DIR, safeName);
  if (fs.existsSync(cachedPath)) return cachedPath;
  const buffer = await loadUpload(filename);
  if (!buffer) return null;
  fs.mkdirSync(UPLOAD_CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachedPath, buffer);
  return cachedPath;
}

export function makeOutputTempDir(opportunityId: string): string {
  const dir = path.join(os.tmpdir(), "ssiq-gen", opportunityId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function fileToBase64(filePath: string): { base64: string; mimeType: string } {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".avif": "image/avif",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
  };
  return {
    base64: buffer.toString("base64"),
    mimeType: mimeMap[ext] || "image/png",
  };
}
