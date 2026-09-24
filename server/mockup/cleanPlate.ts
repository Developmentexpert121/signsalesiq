import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { logger } from "../logger";
import { pointInQuad } from "./composite";
import { callGeminiWithRetry, type GeminiUsage } from "./geminiClient";
import { normalizeExifOrientation, sortPlanePointsTLTRBRBL } from "./imageOps";

const CLEAN_PLATE_PROMPT = `You are a professional photo retoucher preparing a wall surface for a new sign installation.

The attached image is a region of a building wall that may already have a sign, lettering, graphics, banner, decal, or other mounted object on it.

Your task: REMOVE any existing sign, lettering, logo, graphic, banner, decal, bracket, or mounted object from the wall, and reconstruct the bare wall surface that would be behind it.

ABSOLUTE RULES:
1. Preserve the wall's REAL material, color, and texture exactly — brick courses, panel seams, stucco, concrete, wood grain, tile lines, grout, weathering, stains, and surface imperfections must continue naturally across the cleared area.
2. Preserve the existing LIGHTING — same direction, color temperature, highlights, shadows, and ambient shading. Do not flatten or relight the wall.
3. Match perspective and scale to the surrounding wall — reconstructed areas must line up seamlessly with the parts of the wall that had nothing on them.
4. Do NOT add anything new: no sign, no text, no logo, no decoration, no placeholder, no watermark.
5. OUTPUT: a full photorealistic PNG at the same dimensions and perspective as the input, showing only the clean, empty wall.`;

/**
 * Removes any existing signage from the selected plane region and reconstructs the bare
 * wall behind it, returning a full-canvas buffer. Only pixels inside the plane quad are
 * replaced (feathered); everything outside is byte-for-byte the original.
 *
 * Never throws — returns `null` on any failure so the caller can keep the original canvas.
 */
export async function cleanPlanePlate(params: {
  canvasPath: string;
  planePoints: { x: number; y: number }[];
  contextPadding?: number;
}): Promise<{ buffer: Buffer; usage: GeminiUsage } | null> {
  const { canvasPath, planePoints, contextPadding = 24 } = params;
  if (!planePoints || planePoints.length < 4) return null;

  let cropTempPath: string | null = null;
  try {
    const normalizedBuf = await normalizeExifOrientation(canvasPath);
    const meta = await sharp(normalizedBuf).metadata();
    const imgW = meta.width || 2000;
    const imgH = meta.height || 2000;

    const ordered = sortPlanePointsTLTRBRBL(planePoints);
    const xs = planePoints.map((p) => p.x);
    const ys = planePoints.map((p) => p.y);
    const left = Math.max(0, Math.round(Math.min(...xs)) - contextPadding);
    const top = Math.max(0, Math.round(Math.min(...ys)) - contextPadding);
    const right = Math.min(imgW, Math.round(Math.max(...xs)) + contextPadding);
    const bottom = Math.min(imgH, Math.round(Math.max(...ys)) + contextPadding);
    const cropW = Math.max(1, right - left);
    const cropH = Math.max(1, bottom - top);

    const cropBuf = await sharp(normalizedBuf)
      .extract({ left, top, width: cropW, height: cropH })
      .png()
      .toBuffer();

    // Persist the crop so the secondary (proxy) Gemini path — which reads images from
    // disk — can re-send the same region if the primary call is exhausted.
    cropTempPath = path.join(
      os.tmpdir(),
      `cleanplate_crop_${Date.now()}_${Math.round(Math.random() * 1e6)}.png`
    );
    fs.writeFileSync(cropTempPath, cropBuf);

    const parts = [
      { text: CLEAN_PLATE_PROMPT },
      { text: "\n\n[WALL REGION TO CLEAN]" },
      { inlineData: { mimeType: "image/png", data: cropBuf.toString("base64") } },
    ];

    const cleanResult = await callGeminiWithRetry(parts, 2, {
      textPrompt: CLEAN_PLATE_PROMPT,
      referenceFilePaths: [cropTempPath],
    });

    // Normalize the model output to exactly the crop dimensions so it aligns on paste-back.
    const cleanedRgba = await sharp(cleanResult.buffer)
      .resize(cropW, cropH, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer();

    // Feathered alpha mask: opaque inside the plane quad, transparent outside, so only the
    // selected region is replaced and the surrounding context stays exactly the original.
    const mask = Buffer.alloc(cropW * cropH, 0);
    for (let row = 0; row < cropH; row++) {
      for (let col = 0; col < cropW; col++) {
        if (pointInQuad(left + col, top + row, ordered)) mask[row * cropW + col] = 255;
      }
    }
    const { data: featheredMask, info: fmInfo } = await sharp(mask, {
      raw: { width: cropW, height: cropH, channels: 1 },
    })
      .blur(3)
      .raw()
      .toBuffer({ resolveWithObject: true });
    // sharp may emit a multi-channel raw buffer from a single-channel input — read channel 0.
    const fmStride = fmInfo.channels;
    for (let i = 0; i < cropW * cropH; i++) {
      cleanedRgba[i * 4 + 3] = featheredMask[i * fmStride];
    }

    const cleanedPatch = await sharp(cleanedRgba, {
      raw: { width: cropW, height: cropH, channels: 4 },
    })
      .png()
      .toBuffer();

    const out = await sharp(normalizedBuf)
      .composite([{ input: cleanedPatch, left, top }])
      .png()
      .toBuffer();

    logger.info(
      `[Clean Plate] Reconstructed wall in plane region (${cropW}x${cropH} at ${left},${top})`
    );
    return { buffer: out, usage: cleanResult.usage };
  } catch (err: any) {
    logger.warn(`[Clean Plate] Failed (keeping original canvas): ${err?.message ?? err}`);
    return null;
  } finally {
    if (cropTempPath) {
      try {
        fs.unlinkSync(cropTempPath);
      } catch (_) {}
    }
  }
}
