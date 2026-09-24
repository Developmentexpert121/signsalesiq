import { randomBytes } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";

import { deleteObject, getObject, outputKey, putObject, uploadKey } from "./cloudStorage";

export async function saveUpload(filename: string, buffer: Buffer, mime: string): Promise<void> {
  let ok = false;
  try {
    ok = await putObject(uploadKey(filename), buffer, mime);
  } catch (err: any) {
    const wrapped = new Error(
      `Failed to persist upload to object storage: ${filename} (cause: ${err.message})`
    );
    (wrapped as any).cause = err;
    throw wrapped;
  }
  if (!ok) {
    throw new Error(`Failed to persist upload to object storage: ${filename}`);
  }
}

export async function saveOutput(
  oppId: string,
  filename: string,
  buffer: Buffer,
  mime: string
): Promise<void> {
  let ok = false;
  try {
    ok = await putObject(outputKey(oppId, filename), buffer, mime);
  } catch (err: any) {
    const wrapped = new Error(
      `Failed to persist output to object storage: ${oppId}/${filename} (cause: ${err.message})`
    );
    (wrapped as any).cause = err;
    throw wrapped;
  }
  if (!ok) {
    throw new Error(`Failed to persist output to object storage: ${oppId}/${filename}`);
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function loadUpload(filename: string): Promise<Buffer | null> {
  const obj = await getObject(uploadKey(filename));
  if (!obj) return null;
  return streamToBuffer(obj.stream);
}

export async function loadOutput(oppId: string, filename: string): Promise<Buffer | null> {
  const obj = await getObject(outputKey(oppId, filename));
  if (!obj) return null;
  return streamToBuffer(obj.stream);
}

export async function deleteOutput(oppId: string, filename: string): Promise<void> {
  await deleteObject(outputKey(oppId, filename));
}

export async function deleteUpload(filename: string): Promise<void> {
  await deleteObject(uploadKey(filename));
}

/**
 * Materialize a buffer to a temp file for tools that require a real path
 * (e.g. pdftoppm). The temp directory is always removed afterwards.
 */
export async function withTempFile<T>(
  buffer: Buffer,
  ext: string,
  fn: (filePath: string) => Promise<T>
): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ssiq-"));
  const safeExt = ext.startsWith(".") ? ext : `.${ext}`;
  const filePath = path.join(dir, `${randomBytes(8).toString("hex")}${safeExt}`);
  try {
    fs.writeFileSync(filePath, buffer);
    return await fn(filePath);
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }
}
