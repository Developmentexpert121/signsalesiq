import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const DO_SPACES_KEY = process.env.DO_SPACES_KEY;
const DO_SPACES_SECRET = process.env.DO_SPACES_SECRET;
const DO_SPACES_ENDPOINT = process.env.DO_SPACES_ENDPOINT;
const DO_SPACES_BUCKET = process.env.DO_SPACES_BUCKET;
const DO_SPACES_REGION = process.env.DO_SPACES_REGION || "nyc3";

if (!DO_SPACES_KEY || !DO_SPACES_SECRET || !DO_SPACES_ENDPOINT || !DO_SPACES_BUCKET) {
  console.error(
    "Missing DO Spaces configuration. Set DO_SPACES_KEY, DO_SPACES_SECRET, DO_SPACES_ENDPOINT, DO_SPACES_BUCKET"
  );
  process.exit(1);
}

function deriveEndpoint(rawEndpoint: string): string {
  try {
    const url = new URL(rawEndpoint.startsWith("http") ? rawEndpoint : `https://${rawEndpoint}`);
    const hostParts = url.hostname.split(".");
    if (hostParts.length > 3) {
      return `https://${hostParts.slice(1).join(".")}`;
    }
    return url.origin;
  } catch {
    return rawEndpoint.startsWith("http") ? rawEndpoint : `https://${rawEndpoint}`;
  }
}

const endpoint = deriveEndpoint(DO_SPACES_ENDPOINT);
console.log(
  `Using endpoint: ${endpoint}, bucket: ${DO_SPACES_BUCKET}, region: ${DO_SPACES_REGION}`
);

const s3 = new S3Client({
  endpoint,
  region: DO_SPACES_REGION.toLowerCase(),
  credentials: {
    accessKeyId: DO_SPACES_KEY,
    secretAccessKey: DO_SPACES_SECRET,
  },
  forcePathStyle: false,
});

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
  };
  return mimeMap[ext] || "application/octet-stream";
}

async function uploadFile(localPath: string, cloudKey: string): Promise<boolean> {
  try {
    const fileContent = fs.readFileSync(localPath);
    await s3.send(
      new PutObjectCommand({
        Bucket: DO_SPACES_BUCKET!,
        Key: cloudKey,
        Body: fileContent,
        ContentType: getMimeType(localPath),
        ACL: "private",
      })
    );
    return true;
  } catch (err: any) {
    console.error(`  FAILED ${cloudKey}: ${err.message}`);
    return false;
  }
}

async function run() {
  let uploaded = 0;
  let failed = 0;
  let skipped = 0;

  const uploadsDir = path.resolve("uploads");
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir).filter((f) => !f.startsWith("."));
    console.log(`=== Uploading ${files.length} files from uploads/ ===`);
    for (const file of files) {
      const localPath = path.join(uploadsDir, file);
      if (!fs.statSync(localPath).isFile()) continue;
      const cloudKey = `uploads/${file}`;
      const ok = await uploadFile(localPath, cloudKey);
      if (ok) {
        uploaded++;
        console.log(`  OK ${cloudKey}`);
      } else {
        failed++;
      }
    }
  } else {
    console.log("No uploads/ directory found");
  }

  const outputsDir = path.resolve("outputs");
  if (fs.existsSync(outputsDir)) {
    const oppDirs = fs.readdirSync(outputsDir).filter((d) => {
      const fullPath = path.join(outputsDir, d);
      return fs.statSync(fullPath).isDirectory();
    });
    console.log(`\n=== Uploading outputs from ${oppDirs.length} opportunity dirs ===`);
    for (const oppId of oppDirs) {
      const oppDir = path.join(outputsDir, oppId);
      const files = fs.readdirSync(oppDir).filter((f) => !f.startsWith("."));
      for (const file of files) {
        const localPath = path.join(oppDir, file);
        if (!fs.statSync(localPath).isFile()) continue;
        const cloudKey = `outputs/${oppId}/${file}`;
        const ok = await uploadFile(localPath, cloudKey);
        if (ok) {
          uploaded++;
        } else {
          failed++;
        }
      }
      console.log(`  ${oppId}: ${files.length} files`);
    }
  } else {
    console.log("No outputs/ directory found");
  }

  console.log(`\n=== Migration complete ===`);
  console.log(`  Uploaded: ${uploaded}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped: ${skipped}`);
}

run();
