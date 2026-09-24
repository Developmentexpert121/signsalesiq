import crypto from "crypto";
import { createRequire } from "module";
import path from "path";
import sharp from "sharp";

const SUPPORTED_VECTOR_EXTENSIONS = [".svg", ".pdf"];
const UNSUPPORTED_VECTOR_EXTENSIONS = [".ai", ".cdr", ".dxf", ".eps"];

// pdf.js renders against a handful of DOM-ish globals. @napi-rs/canvas ships
// Node implementations; they must be installed before pdf.js builds any paths.
let canvasGlobalsInstalled = false;
function installCanvasGlobals(canvasMod: any): void {
  if (canvasGlobalsInstalled) return;
  for (const key of ["Path2D", "DOMMatrix", "ImageData", "DOMPoint"]) {
    if (!(globalThis as any)[key] && canvasMod[key]) {
      (globalThis as any)[key] = canvasMod[key];
    }
  }
  canvasGlobalsInstalled = true;
}

/**
 * Rasterize the first page of a PDF into a transparent-background PNG buffer,
 * fully in-process (no external binaries like pdftoppm). pdf.js renders into an
 * @napi-rs/canvas surface; the raw RGBA pixels are then PNG-encoded by sharp.
 * sharp preserves the alpha channel, whereas @napi-rs/canvas's own PNG encoder
 * flattens transparency onto white — so empty page areas stay transparent and
 * the logo composites cleanly into mockups.
 */
async function rasterizePdfToPng(buffer: Buffer): Promise<Buffer> {
  const canvasMod: any = await import("@napi-rs/canvas");
  installCanvasGlobals(canvasMod);
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

  let standardFontDataUrl: string | undefined;
  try {
    // Resolve the bundled standard-fonts dir. __filename is defined under tsx
    // (dev) and in the bundled CJS build; fall back to cwd for the ESM test
    // runner. We avoid import.meta.url because it is empty in the CJS bundle.
    const fromPath =
      typeof __filename !== "undefined" ? __filename : path.join(process.cwd(), "index.js");
    const pdfjsDir = path.dirname(createRequire(fromPath).resolve("pdfjs-dist/package.json"));
    // pdf.js requires a trailing forward slash, even on Windows.
    standardFontDataUrl = `${path.join(pdfjsDir, "standard_fonts").split(path.sep).join("/")}/`;
  } catch {
    /* best-effort: standard fonts only matter for some text-heavy PDFs */
  }

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useWorkerFetch: false,
    standardFontDataUrl,
  }).promise;

  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    // Target ~300 DPI (PDF user space is 72 DPI) but clamp the longest side
    // to bound memory for unusually large pages.
    const MAX_SIDE = 3000;
    const scale = Math.min(300 / 72, MAX_SIDE / Math.max(base.width, base.height, 1));
    const viewport = page.getViewport({ scale });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);

    const canvas = canvasMod.createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport, background: "rgba(0,0,0,0)" }).promise;
    page.cleanup();

    const rgba = Buffer.from(ctx.getImageData(0, 0, width, height).data);
    return await sharp(rgba, { raw: { width, height, channels: 4 } })
      .png()
      .toBuffer();
  } finally {
    await doc.destroy();
  }
}

export function isVectorFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_VECTOR_EXTENSIONS.includes(ext) || UNSUPPORTED_VECTOR_EXTENSIONS.includes(ext);
}

export function isConvertibleFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_VECTOR_EXTENSIONS.includes(ext);
}

export function isUnsupportedVectorFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return UNSUPPORTED_VECTOR_EXTENSIONS.includes(ext);
}

export async function convertToPng(
  buffer: Buffer,
  originalname: string
): Promise<{ buffer: Buffer; filename: string; width: number; height: number }> {
  const ext = path.extname(originalname).toLowerCase();
  const filename = `${crypto.randomBytes(16).toString("hex")}_converted.png`;
  let pngBuffer: Buffer;

  if (ext === ".svg") {
    pngBuffer = await sharp(buffer, { density: 300 }).png().toBuffer();
  } else if (ext === ".pdf") {
    pngBuffer = await rasterizePdfToPng(buffer);
  } else {
    throw new Error(`Unsupported format for conversion: ${ext}`);
  }

  const meta = await sharp(pngBuffer).metadata();

  return {
    buffer: pngBuffer,
    filename,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  };
}
