import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

import { env } from "./env";

import { logger } from "./logger";

const DO_SPACES_KEY = env.DO_SPACES_KEY;
const DO_SPACES_SECRET = env.DO_SPACES_SECRET;
const DO_SPACES_ENDPOINT = env.DO_SPACES_ENDPOINT;
const DO_SPACES_BUCKET = env.DO_SPACES_BUCKET;
const DO_SPACES_REGION = env.DO_SPACES_REGION.trim();

export const isDoSpacesConfigured = !!(
  DO_SPACES_KEY &&
  DO_SPACES_SECRET &&
  DO_SPACES_ENDPOINT &&
  DO_SPACES_BUCKET
);

function deriveEndpoint(rawEndpoint: string): string {
  try {
    const url = new URL(rawEndpoint.startsWith("http") ? rawEndpoint : `https://${rawEndpoint}`);
    const hostParts = url.hostname.split(".");
    if (hostParts.length > 3) {
      const regionBase = hostParts.slice(1).join(".");
      return `https://${regionBase}`;
    }
    return url.origin;
  } catch {
    return rawEndpoint.startsWith("http") ? rawEndpoint : `https://${rawEndpoint}`;
  }
}

let s3Client: S3Client | null = null;

function getClient(): S3Client | null {
  if (!isDoSpacesConfigured) return null;
  if (!s3Client) {
    const endpoint = deriveEndpoint(DO_SPACES_ENDPOINT!);
    const region = DO_SPACES_REGION.toLowerCase();
    s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: DO_SPACES_KEY!,
        secretAccessKey: DO_SPACES_SECRET!,
      },
      forcePathStyle: DO_SPACES_ENDPOINT?.includes("localhost") ?? false,
    });
    logger.info(
      `[DO Spaces] Configured: bucket=${DO_SPACES_BUCKET}, endpoint=${endpoint}, region=${region}`
    );
  }
  return s3Client;
}

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
    ".json": "application/json",
  };
  return mimeMap[ext] || "application/octet-stream";
}

export async function doSpacesUpload(localPath: string, cloudKey: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  if (!fs.existsSync(localPath)) return false;

  try {
    const fileContent = fs.readFileSync(localPath);
    await client.send(
      new PutObjectCommand({
        Bucket: DO_SPACES_BUCKET!,
        Key: cloudKey,
        Body: fileContent,
        ContentType: getMimeType(localPath),
      })
    );
    return true;
  } catch (err: any) {
    const status = err.$metadata?.httpStatusCode;
    const reqId = err.$metadata?.requestId;
    logger.error(
      `[DO Spaces] Upload failed for ${cloudKey}: ${err.name ?? "Error"} ${status ?? ""} ${err.message} (reqId=${reqId ?? "n/a"})`
    );
    throw err;
  }
}

export async function doSpacesDownload(cloudKey: string, localPath: string): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    const response = await client.send(
      new GetObjectCommand({
        Bucket: DO_SPACES_BUCKET!,
        Key: cloudKey,
      })
    );

    if (!response.Body) return false;

    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const stream = response.Body as Readable;
    const writeStream = fs.createWriteStream(localPath);
    await new Promise<void>((resolve, reject) => {
      stream.pipe(writeStream);
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
      stream.on("error", reject);
    });
    return true;
  } catch (err: any) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    logger.error(`[DO Spaces] Download failed for ${cloudKey}: ${err.message}`);
    return false;
  }
}

export async function doSpacesUploadBuffer(
  buffer: Buffer,
  cloudKey: string,
  contentType: string
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: DO_SPACES_BUCKET!,
        Key: cloudKey,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return true;
  } catch (err: any) {
    const status = err.$metadata?.httpStatusCode;
    const reqId = err.$metadata?.requestId;
    logger.error(
      `[DO Spaces] Buffer upload failed for ${cloudKey}: ${err.name ?? "Error"} ${status ?? ""} ${err.message} (reqId=${reqId ?? "n/a"})`
    );
    throw err;
  }
}

export async function doSpacesGetObject(
  cloudKey: string
): Promise<{ body: Readable; contentType?: string } | null> {
  try {
    const client = getClient();
    if (!client) return null;
    const response = await client.send(
      new GetObjectCommand({
        Bucket: DO_SPACES_BUCKET!,
        Key: cloudKey,
      })
    );
    if (!response.Body) return null;
    return {
      body: response.Body as Readable,
      contentType: response.ContentType,
    };
  } catch (err: any) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    logger.error(`[DO Spaces] Get failed for ${cloudKey}: ${err.message}`);
    return null;
  }
}

export async function doSpacesDeleteObject(cloudKey: string): Promise<void> {
  try {
    const client = getClient();
    if (!client) return;
    await client.send(
      new DeleteObjectCommand({
        Bucket: DO_SPACES_BUCKET!,
        Key: cloudKey,
      })
    );
  } catch (err: any) {
    logger.error(`[DO Spaces] Delete failed for ${cloudKey}: ${err.message}`);
  }
}

export async function doSpacesExists(cloudKey: string): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    await client.send(
      new HeadObjectCommand({
        Bucket: DO_SPACES_BUCKET!,
        Key: cloudKey,
      })
    );
    return true;
  } catch {
    return false;
  }
}
