import sharp from "sharp";
import { loadUpload, saveOutput } from "./objectStore";

function perspectiveTransform(
  srcWidth: number,
  srcHeight: number,
  destPoints: { x: number; y: number }[]
): { x: number; y: number; width: number; height: number } {
  const xs = destPoints.map((p) => p.x);
  const ys = destPoints.map((p) => p.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

export async function generateComposite(params: {
  canvasFilename: string;
  logoFilename?: string;
  planePoints: { x: number; y: number }[];
  tier: string;
  opportunityId: string;
  clientName: string;
  signType: string;
}): Promise<string> {
  const { canvasFilename, logoFilename, planePoints, tier, opportunityId, clientName, signType } =
    params;

  const canvasBuffer = await loadUpload(canvasFilename);
  if (!canvasBuffer) {
    throw new Error("Canvas image not found");
  }

  const canvasImage = sharp(canvasBuffer);
  const canvasMeta = await canvasImage.metadata();
  const canvasWidth = canvasMeta.width || 1200;
  const canvasHeight = canvasMeta.height || 800;

  const bbox = perspectiveTransform(canvasWidth, canvasHeight, planePoints);

  const overlayWidth = Math.max(Math.round(bbox.width), 50);
  const overlayHeight = Math.max(Math.round(bbox.height), 30);

  const tierColors: Record<string, string> = {
    GOOD: "#2563eb",
    BETTER: "#7c3aed",
    BEST: "#059669",
  };
  const tierColor = tierColors[tier] || "#2563eb";

  let overlayBuffer: Buffer;

  const logoBuffer = logoFilename ? await loadUpload(logoFilename) : null;
  if (logoBuffer) {
    try {
      overlayBuffer = await sharp(logoBuffer)
        .resize(overlayWidth, overlayHeight, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .png()
        .toBuffer();
    } catch {
      overlayBuffer = await createTextOverlay(
        overlayWidth,
        overlayHeight,
        clientName,
        tier,
        tierColor
      );
    }
  } else {
    overlayBuffer = await createTextOverlay(
      overlayWidth,
      overlayHeight,
      clientName,
      tier,
      tierColor
    );
  }

  const shadowBuffer = await sharp(overlayBuffer)
    .blur(3)
    .modulate({ brightness: 0.3 })
    .ensureAlpha(0.4)
    .toBuffer();

  const outputFilename = `composite_${tier.toLowerCase()}_${Date.now()}.png`;

  const compositeBuffer = await sharp(canvasBuffer)
    .composite([
      {
        input: shadowBuffer,
        left: Math.round(bbox.x) + 3,
        top: Math.round(bbox.y) + 3,
      },
      {
        input: overlayBuffer,
        left: Math.round(bbox.x),
        top: Math.round(bbox.y),
      },
    ])
    .png()
    .toBuffer();

  await saveOutput(opportunityId, outputFilename, compositeBuffer, "image/png");
  return outputFilename;
}

async function createTextOverlay(
  width: number,
  height: number,
  text: string,
  tier: string,
  color: string
): Promise<Buffer> {
  const fontSize = Math.max(Math.min(Math.floor(height * 0.3), 72), 12);
  const tierFontSize = Math.max(Math.floor(fontSize * 0.5), 10);

  const svgText = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:0.9" />
          <stop offset="100%" style="stop-color:${color};stop-opacity:0.7" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="4" fill="url(#bg)" />
      <text x="${width / 2}" y="${height / 2 - tierFontSize * 0.3}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">
        ${escapeXml(text.substring(0, 20))}
      </text>
      <text x="${width / 2}" y="${height / 2 + fontSize * 0.6}" font-family="Arial, sans-serif" font-size="${tierFontSize}" fill="rgba(255,255,255,0.8)" text-anchor="middle" dominant-baseline="middle">
        ${tier} TIER
      </text>
    </svg>
  `;

  return sharp(Buffer.from(svgText)).png().toBuffer();
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
