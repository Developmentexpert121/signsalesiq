import path from "path";
import fs from "fs";

const CWD = process.cwd();
export const UPLOADS_DIR = path.join(CWD, "uploads");
export const DIST_UPLOADS_DIR = path.join(CWD, "dist", "uploads");
export const OUTPUTS_DIR = path.join(CWD, "outputs");
export const DIST_OUTPUTS_DIR = path.join(CWD, "dist", "outputs");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

export function resolveUploadFile(filename: string): string | null {
  const primary = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(primary)) return primary;
  const fallback = path.join(DIST_UPLOADS_DIR, filename);
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

export function resolveOutputFile(oppId: string, filename: string): string | null {
  const primary = path.join(OUTPUTS_DIR, oppId, filename);
  if (fs.existsSync(primary)) return primary;
  const fallback = path.join(DIST_OUTPUTS_DIR, oppId, filename);
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

export async function resolveUploadFileAsync(filename: string): Promise<string | null> {
  const local = resolveUploadFile(filename);
  if (local) return local;
  try {
    const { resolveUploadFromCloud } = await import("./cloudStorage");
    return await resolveUploadFromCloud(filename, UPLOADS_DIR);
  } catch {
    return null;
  }
}

export async function resolveOutputFileAsync(
  oppId: string,
  filename: string
): Promise<string | null> {
  const local = resolveOutputFile(oppId, filename);
  if (local) return local;
  try {
    const { resolveOutputFromCloud } = await import("./cloudStorage");
    return await resolveOutputFromCloud(oppId, filename, OUTPUTS_DIR);
  } catch {
    return null;
  }
}
