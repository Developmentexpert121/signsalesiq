import sharp from "sharp";
import { logger } from "../logger";

// Sign elements are rendered against a flat pure-magenta (#FF00FF) field (see the
// chroma-background override in buildSignPrompt). Magenta is chosen because it is rare in
// real signage and trivially separable: "magenta-ness" = min(R,B) − G is high only for
// magenta, and ~0 for red, blue, white, black, and most sign colors.
const CHROMA_LOW = 40; // magenta-ness ≤ this → fully sign (alpha 255)
const CHROMA_HIGH = 120; // magenta-ness ≥ this → fully background (alpha 0)

function magentaness(r: number, g: number, b: number): number {
  return Math.min(r, b) - g;
}

/**
 * Keys out the flat magenta background from a generated sign image, returning an RGBA PNG
 * with a transparent (feathered) background and light magenta-spill suppression on edges.
 *
 * Returns `null` when the image does not actually have a magenta field (the model ignored
 * the chroma instruction), so the caller can fall back to warping the whole trimmed image.
 */
export async function extractSignMatte(signBuffer: Buffer): Promise<Buffer | null> {
  const { data, info } = await sharp(signBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const px = width * height;

  // Presence check: sample the four corners. If they aren't predominantly magenta, the
  // model didn't render the requested chroma field — bail so the caller warps as-is.
  const block = Math.max(4, Math.round(Math.min(width, height) * 0.06));
  let cornerSamples = 0;
  let cornerMagenta = 0;
  const corners: [number, number][] = [
    [0, 0],
    [width - block, 0],
    [0, height - block],
    [width - block, height - block],
  ];
  for (const [cx, cy] of corners) {
    for (let y = cy; y < cy + block; y++) {
      for (let x = cx; x < cx + block; x++) {
        const i = (y * width + x) * 4;
        cornerSamples++;
        if (magentaness(data[i], data[i + 1], data[i + 2]) >= CHROMA_HIGH) cornerMagenta++;
      }
    }
  }
  const cornerFrac = cornerSamples > 0 ? cornerMagenta / cornerSamples : 0;
  if (cornerFrac < 0.5) {
    logger.info(
      `[Matte] Magenta field not detected (corner magenta ${(cornerFrac * 100).toFixed(0)}%) — skipping chroma key`
    );
    return null;
  }

  const alpha = Buffer.alloc(px);
  const span = CHROMA_HIGH - CHROMA_LOW;
  for (let p = 0; p < px; p++) {
    const i = p * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const m = magentaness(r, g, b);
    // High magenta-ness → background (alpha 0); low → sign (alpha 255); linear feather between.
    let a = 255;
    if (m >= CHROMA_HIGH) a = 0;
    else if (m > CHROMA_LOW) a = Math.round(255 * (1 - (m - CHROMA_LOW) / span));
    alpha[p] = a;

    // Light despill: pull residual magenta fringe toward green on partially/anti-aliased
    // edges. Pure red/blue/white have m≈0 and are untouched.
    if (a > 0 && a < 255 && m > 0) {
      const cut = Math.round(m * 0.5);
      data[i] = Math.max(g, r - cut);
      data[i + 2] = Math.max(g, b - cut);
    }
  }

  // Soften the matte edge by 1px so it composites without a hard cutout line. sharp may
  // emit a multi-channel raw buffer from a single-channel input, so read channel 0 by stride.
  const { data: fa, info: faInfo } = await sharp(alpha, { raw: { width, height, channels: 1 } })
    .blur(1)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const stride = faInfo.channels;
  for (let p = 0; p < px; p++) data[p * 4 + 3] = fa[p * stride];

  return sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}
