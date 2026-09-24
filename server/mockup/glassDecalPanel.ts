import sharp from "sharp";
import { logger } from "../logger";
import { resolveUploadFileAsync } from "./uploadCache";

// Flat neutral grey panel + centered logo, sized to the plane. Used as a deterministic
// stand-in for the AI sign render on glass-wall-decal types, where the image model invents a
// framed interior scene instead of a clean decal on real storefront glass. The panel is
// perspective-warped into the plane downstream by compositeSignOntoPhoto.
const BOX_GREY = { r: 168, g: 168, b: 168 }; // #A8A8A8
const BORDER_GREY = "#888888";
const TEXT_GREY = "#2B2B2B";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build a flat opaque grey panel filling planeWidth × planeHeight with the client logo
 * centered (or the client name as fallback text). Returns a PNG buffer. Never throws — a
 * failed logo render falls back to text.
 */
export async function buildGlassDecalPanel(params: {
  logoFilename?: string;
  clientName: string;
  planeWidth: number;
  planeHeight: number;
}): Promise<Buffer> {
  const { logoFilename, clientName } = params;
  const W = Math.max(Math.round(params.planeWidth), 100);
  const H = Math.max(Math.round(params.planeHeight), 50);

  const base = sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: { ...BOX_GREY, alpha: 1 },
    },
  });

  const layers: sharp.OverlayOptions[] = [];

  // Center content sits inside a ~12% padding margin so the logo reads as a framed decal.
  const padding = Math.round(Math.min(W, H) * 0.12);
  const innerW = Math.max(W - padding * 2, 1);
  const innerH = Math.max(H - padding * 2, 1);

  const resolvedLogoPath = logoFilename ? await resolveUploadFileAsync(logoFilename) : null;
  let centerLayer: Buffer | null = null;

  if (resolvedLogoPath) {
    try {
      // Preserve the logo's original colors and transparency (no recolor) — same contract as
      // the AI path's [CLIENT LOGO] handling. Aspect drift becomes transparent padding.
      centerLayer = await sharp(resolvedLogoPath)
        .resize(innerW, innerH, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
    } catch (err: any) {
      logger.warn(
        `[Glass Decal Panel] Logo render failed (${err?.message ?? err}) — falling back to client-name text`
      );
      centerLayer = null;
    }
  }

  if (!centerLayer) {
    centerLayer = await buildClientNameText(innerW, innerH, clientName);
  }

  layers.push({ input: centerLayer, gravity: "center" });

  // Thin darker border to read as a framed decal edge.
  const border = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="${BORDER_GREY}" stroke-width="2"/></svg>`
  );
  layers.push({ input: border, top: 0, left: 0 });

  return base.composite(layers).png().toBuffer();
}

async function buildClientNameText(width: number, height: number, text: string): Promise<Buffer> {
  const fontSize = Math.max(Math.min(Math.floor(height * 0.28), 64), 12);
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="${width / 2}" y="${height / 2}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="${TEXT_GREY}" text-anchor="middle" dominant-baseline="middle" font-weight="bold">${escapeXml(text.substring(0, 28))}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
