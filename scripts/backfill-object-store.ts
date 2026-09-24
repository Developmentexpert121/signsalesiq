import "dotenv/config";
import fs from "fs";
import path from "path";

import { UPLOADS_DIR, DIST_UPLOADS_DIR, OUTPUTS_DIR, DIST_OUTPUTS_DIR } from "../server/filePaths";
import {
  getObject,
  putObject,
  uploadKey,
  outputKey,
  isObjectStorageConfigured,
} from "../server/cloudStorage";

/**
 * Best-effort, idempotent backfill of legacy on-disk files into object storage.
 * Object storage is now authoritative; this pushes any files that exist on
 * local/dist disk but were never synced. Already-present objects are skipped.
 */

function mimeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
  };
  return map[ext] || "application/octet-stream";
}

let pushed = 0;
let skipped = 0;
let failed = 0;
let missing = 0;

async function backfill(localPath: string, key: string): Promise<void> {
  if (!fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) {
    missing++;
    return;
  }
  const existing = await getObject(key);
  if (existing) {
    existing.stream.destroy?.();
    skipped++;
    return;
  }
  try {
    const ok = await putObject(key, fs.readFileSync(localPath), mimeFor(localPath));
    if (ok) {
      pushed++;
      console.log(`  PUT ${key}`);
    } else {
      failed++;
      console.error(`  FAILED ${key}`);
    }
  } catch (err: any) {
    failed++;
    console.error(`  FAILED ${key}: ${err?.message || err}`);
  }
}

async function backfillUploadsDir(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir).filter((f) => !f.startsWith("."))) {
    await backfill(path.join(dir, entry), uploadKey(entry));
  }
}

async function backfillOutputsDir(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) return;
  for (const oppId of fs.readdirSync(dir)) {
    const oppDir = path.join(dir, oppId);
    if (!fs.statSync(oppDir).isDirectory()) continue;
    for (const entry of fs.readdirSync(oppDir).filter((f) => !f.startsWith("."))) {
      await backfill(path.join(oppDir, entry), outputKey(oppId, entry));
    }
  }
}

async function run(): Promise<void> {
  if (!isObjectStorageConfigured) {
    console.error(
      "Object storage is not configured. Set DO_SPACES_* env vars or run with Replit object storage."
    );
    process.exit(1);
  }

  console.log("=== Backfilling uploads/ ===");
  await backfillUploadsDir(UPLOADS_DIR);
  await backfillUploadsDir(DIST_UPLOADS_DIR);

  console.log("=== Backfilling outputs/ ===");
  await backfillOutputsDir(OUTPUTS_DIR);
  await backfillOutputsDir(DIST_OUTPUTS_DIR);

  console.log("\n=== Backfill complete ===");
  console.log(`  Pushed:  ${pushed}`);
  console.log(`  Skipped (already present): ${skipped}`);
  console.log(`  Missing: ${missing}`);
  console.log(`  Failed:  ${failed}`);
}

run();
