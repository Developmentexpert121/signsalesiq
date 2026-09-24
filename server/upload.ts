import crypto from "crypto";
import multer from "multer";
import path from "path";

export const ALLOWED_UPLOAD_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".pdf",
  ".ai",
  ".eps",
]);

/**
 * In-memory storage that still assigns a generated `filename` (random hex +
 * original extension) so existing route code that reads `req.file.filename`
 * keeps working. The bytes are exposed as `req.file.buffer`; nothing is written
 * to local disk. Persistence is the caller's responsibility via objectStore.
 */
class MemoryNamedStorage implements multer.StorageEngine {
  _handleFile(
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error?: any, info?: Partial<Express.Multer.File>) => void
  ): void {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${crypto.randomBytes(16).toString("hex")}${ext}`;
    const chunks: Buffer[] = [];
    file.stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    file.stream.on("end", () => {
      const buffer = Buffer.concat(chunks);
      cb(null, { filename, buffer, size: buffer.length });
    });
    file.stream.on("error", cb);
  }

  _removeFile(
    _req: Express.Request,
    _file: Express.Multer.File,
    cb: (error: Error | null) => void
  ): void {
    cb(null);
  }
}

export const upload = multer({
  storage: new MemoryNamedStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ALLOWED_UPLOAD_EXTS.has(ext));
  },
});
