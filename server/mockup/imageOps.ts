import sharp from "sharp";

export async function normalizeExifOrientation(canvasPath: string): Promise<Buffer> {
  return sharp(canvasPath).rotate().png().toBuffer();
}

export function sortPlanePointsTLTRBRBL(
  points: { x: number; y: number }[]
): { x: number; y: number }[] {
  const sorted = [...points];
  sorted.sort((a, b) => a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bottom[1], bottom[0]];
}

export async function cropPlaneRegion(
  canvasPath: string,
  planePoints: { x: number; y: number }[],
  contextPadding = 0
): Promise<Buffer> {
  const xs = planePoints.map((p) => p.x);
  const ys = planePoints.map((p) => p.y);
  const normalizedBuf = await normalizeExifOrientation(canvasPath);
  const meta = await sharp(normalizedBuf).metadata();
  const imgW = meta.width || 2000;
  const imgH = meta.height || 2000;

  const left = Math.max(0, Math.round(Math.min(...xs)) - contextPadding);
  const top = Math.max(0, Math.round(Math.min(...ys)) - contextPadding);
  const right = Math.min(imgW, Math.round(Math.max(...xs)) + contextPadding);
  const bottom = Math.min(imgH, Math.round(Math.max(...ys)) + contextPadding);
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);

  return sharp(normalizedBuf).extract({ left, top, width, height }).png().toBuffer();
}

export async function createDownscaledContext(canvasPath: string, maxDim = 512): Promise<Buffer> {
  const normalizedBuf = await normalizeExifOrientation(canvasPath);
  const meta = await sharp(normalizedBuf).metadata();
  const w = meta.width || 1200;
  const h = meta.height || 800;
  const scale = Math.min(maxDim / w, maxDim / h, 1);
  return sharp(normalizedBuf)
    .resize(Math.round(w * scale), Math.round(h * scale), { fit: "inside" })
    .png()
    .toBuffer();
}
