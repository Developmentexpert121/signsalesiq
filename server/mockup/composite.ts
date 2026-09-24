import fs from "fs";
import sharp from "sharp";
import { logger } from "../logger";
import { callGeminiWithRetry } from "./geminiClient";
import { normalizeExifOrientation, sortPlanePointsTLTRBRBL } from "./imageOps";
import { fileToBase64 } from "./uploadCache";

export function solveLinearSystem8x8(A: number[][], b: number[]): number[] {
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-10) throw new Error("Singular matrix in perspective solve");

    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / pivot;
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= M[i][j] * x[j];
    }
    x[i] /= M[i][i];
  }
  return x;
}

export function pointInQuad(px: number, py: number, pts: { x: number; y: number }[]): boolean {
  let pos = 0,
    neg = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const cross = (pts[j].x - pts[i].x) * (py - pts[i].y) - (pts[j].y - pts[i].y) * (px - pts[i].x);
    if (cross > 0) pos++;
    else if (cross < 0) neg++;
  }
  return pos === 0 || neg === 0;
}

export async function aiBlendComposite(params: {
  originalSitePhotoPath: string;
  hardCompositePath: string;
  outputPath: string;
}): Promise<void> {
  const { originalSitePhotoPath, hardCompositePath, outputPath } = params;

  const normalizedSiteBuf = await normalizeExifOrientation(originalSitePhotoPath);
  const sitePhoto = { base64: normalizedSiteBuf.toString("base64"), mimeType: "image/png" };
  const hardComposite = fileToBase64(hardCompositePath);

  const blendPrompt = `You are a professional photo compositing expert specializing in architectural visualization and sign mockups.

You are given two images:
IMAGE 1 (BEFORE): The building/site photo with the placement surface already CLEARED — any previous sign has been removed and the bare wall reconstructed. This is the clean backdrop. No other sign should appear in the placement region.
IMAGE 2 (COMPOSITE): The same photo with a sign already correctly positioned, scaled, and perspective-warped onto the building surface. The sign's placement in IMAGE 2 is the definitive final position — it is NOT a mistake or artifact.

Your task: Output IMAGE 2 with only edge-blending and lighting adjustments applied. This is compositing retouching work — not creative placement work. You are not choosing where the sign goes; it is already placed correctly.

ABSOLUTE RULES (violations will make the result unusable):
1. SIGN POSITION IS FROZEN — The sign must occupy EXACTLY the same pixels as in IMAGE 2. Do not move it even one pixel. Do not resize it. Do not rotate it. Do not straighten a deliberately angled/perspective-warped sign — the angle IS intentional and correct.
2. SIGN SHAPE IS FROZEN — If the sign appears trapezoidal or angled due to perspective, that shape must be preserved exactly. Do not make it rectangular if it is not rectangular in IMAGE 2.
3. SIGN CONTENT IS FROZEN — Do not alter any text, colors, logos, or graphic elements on the sign face.
4. ONLY TOUCH THE PERIMETER — Your only allowed changes to the sign area are: (a) feathering/blending the hard edges at the sign's border into the surrounding surface, (b) adjusting overall brightness/contrast to match scene lighting, (c) adding a soft natural shadow at the base/sides consistent with scene lighting direction.
5. PRESERVE EVERYTHING OUTSIDE THE SIGN — Every pixel outside the sign footprint must match IMAGE 1 exactly. Do not alter the sky, ground, trees, vehicles, or any building surface not directly adjacent to the sign border. The placement region around the sign is bare reconstructed wall in IMAGE 1 — keep it bare; do NOT re-add or invent any previous signage, text, or graphics there.
6. OUTPUT — Full photorealistic PNG at the same resolution as IMAGE 2. No watermarks, borders, or annotations.`;

  const parts = [
    { text: blendPrompt },
    { text: "[IMAGE 1 - BEFORE: Original building/site photo, no sign]" },
    {
      inlineData: {
        mimeType: sitePhoto.mimeType,
        data: sitePhoto.base64,
      },
    },
    {
      text: "[IMAGE 2 - HARD COMPOSITE: Sign perspective-warped onto building, needs photorealistic blending]",
    },
    {
      inlineData: {
        mimeType: hardComposite.mimeType,
        data: hardComposite.base64,
      },
    },
  ];

  const blendResult = await callGeminiWithRetry(parts, 3, {
    textPrompt: blendPrompt,
    referenceFilePaths: [originalSitePhotoPath, hardCompositePath],
  });

  const pngBuffer = await sharp(blendResult.buffer).png().toBuffer();
  fs.writeFileSync(outputPath, pngBuffer);
}

export async function compositeSignOntoPhoto(params: {
  canvasPath?: string;
  // Pre-normalized full-canvas buffer (e.g. from cleanPlanePlate). Takes precedence over
  // canvasPath and skips re-normalization, so the clean-plate result is composited onto.
  canvasBuffer?: Buffer;
  signImageBuffer: Buffer;
  planePoints: { x: number; y: number }[];
  outputPath: string;
  reflectionOpacity?: number;
}): Promise<void> {
  const {
    canvasPath,
    canvasBuffer,
    signImageBuffer,
    planePoints,
    outputPath,
    reflectionOpacity = 0,
  } = params;

  let normalizedCanvasBuffer: Buffer;
  if (canvasBuffer) {
    normalizedCanvasBuffer = canvasBuffer;
  } else if (canvasPath) {
    normalizedCanvasBuffer = await normalizeExifOrientation(canvasPath);
  } else {
    throw new Error("compositeSignOntoPhoto requires either canvasBuffer or canvasPath");
  }
  const canvasMeta = await sharp(normalizedCanvasBuffer).metadata();
  const canvasWidth = canvasMeta.width || 1200;
  const canvasHeight = canvasMeta.height || 800;

  const signMeta = await sharp(signImageBuffer).metadata();
  const signW = signMeta.width || 512;
  const signH = signMeta.height || 512;

  const orderedPoints = sortPlanePointsTLTRBRBL(planePoints);

  const xs = orderedPoints.map((p) => p.x);
  const ys = orderedPoints.map((p) => p.y);
  const bbLeft = Math.max(0, Math.floor(Math.min(...xs)));
  const bbTop = Math.max(0, Math.floor(Math.min(...ys)));
  const bbRight = Math.min(canvasWidth, Math.ceil(Math.max(...xs)));
  const bbBottom = Math.min(canvasHeight, Math.ceil(Math.max(...ys)));
  const bbW = bbRight - bbLeft;
  const bbH = bbBottom - bbTop;

  logger.info(
    `[Composite] Plane quad (sorted TL→TR→BR→BL): [${orderedPoints.map((p) => `(${Math.round(p.x)},${Math.round(p.y)})`).join(", ")}]`
  );
  logger.info(
    `[Composite] Bounding box: x=${bbLeft}, y=${bbTop}, w=${bbW}, h=${bbH} (canvas: ${canvasWidth}x${canvasHeight})`
  );
  logger.info(`[Composite] Sign image: ${signW}x${signH}, applying perspective warp`);

  const signRaw = await sharp(signImageBuffer).ensureAlpha().raw().toBuffer();

  const srcPts = [
    { x: 0, y: 0 },
    { x: signW - 1, y: 0 },
    { x: signW - 1, y: signH - 1 },
    { x: 0, y: signH - 1 },
  ];

  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const u = orderedPoints[i].x,
      v = orderedPoints[i].y;
    const sx = srcPts[i].x,
      sy = srcPts[i].y;
    A.push([u, v, 1, 0, 0, 0, -u * sx, -v * sx]);
    b.push(sx);
    A.push([0, 0, 0, u, v, 1, -u * sy, -v * sy]);
    b.push(sy);
  }

  const coeffs = solveLinearSystem8x8(A, b);
  const [ca, cb, cc, cd, ce, cf, cg, ch] = coeffs;

  const outBuf = Buffer.alloc(bbW * bbH * 4, 0);

  for (let row = 0; row < bbH; row++) {
    for (let col = 0; col < bbW; col++) {
      const canvasX = col + bbLeft;
      const canvasY = row + bbTop;

      if (!pointInQuad(canvasX, canvasY, orderedPoints)) continue;

      const denom = cg * canvasX + ch * canvasY + 1;
      if (Math.abs(denom) < 1e-10) continue;
      const srcX = (ca * canvasX + cb * canvasY + cc) / denom;
      const srcY = (cd * canvasX + ce * canvasY + cf) / denom;

      if (srcX < 0 || srcX >= signW - 1 || srcY < 0 || srcY >= signH - 1) continue;

      const sx0 = Math.floor(srcX);
      const sy0 = Math.floor(srcY);
      const sx1 = sx0 + 1;
      const sy1 = sy0 + 1;
      const fx = srcX - sx0;
      const fy = srcY - sy0;

      const idx = (row * bbW + col) * 4;
      for (let c = 0; c < 4; c++) {
        const v00 = signRaw[(sy0 * signW + sx0) * 4 + c];
        const v10 = signRaw[(sy0 * signW + sx1) * 4 + c];
        const v01 = signRaw[(sy1 * signW + sx0) * 4 + c];
        const v11 = signRaw[(sy1 * signW + sx1) * 4 + c];
        outBuf[idx + c] = Math.round(
          v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy
        );
      }
    }
  }

  const featherRadius = 3;
  if (featherRadius > 0 && bbW > featherRadius * 4 && bbH > featherRadius * 4) {
    try {
      const alphaOnly = Buffer.alloc(bbW * bbH);
      for (let i = 0; i < bbW * bbH; i++) {
        alphaOnly[i] = outBuf[i * 4 + 3];
      }
      const { data: blurredAlpha, info: baInfo } = await sharp(alphaOnly, {
        raw: { width: bbW, height: bbH, channels: 1 },
      })
        .blur(featherRadius)
        .raw()
        .toBuffer({ resolveWithObject: true });
      // sharp may emit a multi-channel raw buffer from a single-channel input — read channel 0.
      const baStride = baInfo.channels;
      for (let i = 0; i < bbW * bbH; i++) {
        outBuf[i * 4 + 3] = blurredAlpha[i * baStride];
      }
    } catch (_) {}
  }

  const transformedSign = await sharp(outBuf, {
    raw: { width: bbW, height: bbH, channels: 4 },
  })
    .png()
    .toBuffer();

  const compositeLayers: sharp.OverlayOptions[] = [
    { input: transformedSign, left: bbLeft, top: bbTop },
  ];

  if (reflectionOpacity > 0) {
    try {
      const { data: origRaw } = await sharp(normalizedCanvasBuffer)
        .extract({ left: bbLeft, top: bbTop, width: bbW, height: bbH })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const reflBuf = Buffer.alloc(bbW * bbH * 4);
      for (let i = 0; i < bbW * bbH; i++) {
        reflBuf[i * 4] = origRaw[i * 4];
        reflBuf[i * 4 + 1] = origRaw[i * 4 + 1];
        reflBuf[i * 4 + 2] = origRaw[i * 4 + 2];
        reflBuf[i * 4 + 3] = Math.round(outBuf[i * 4 + 3] * reflectionOpacity);
      }

      const reflectionPng = await sharp(reflBuf, {
        raw: { width: bbW, height: bbH, channels: 4 },
      })
        .png()
        .toBuffer();

      compositeLayers.push({ input: reflectionPng, left: bbLeft, top: bbTop, blend: "over" });
      logger.info(
        `[Composite] Added glass reflection overlay at ${Math.round(reflectionOpacity * 100)}% opacity`
      );
    } catch (reflErr: any) {
      logger.warn(`[Composite] Reflection overlay skipped: ${reflErr.message}`);
    }
  }

  logger.info(
    `[Composite] Perspective warp complete (feathered ${featherRadius}px edges), compositing onto canvas`
  );

  await sharp(normalizedCanvasBuffer).composite(compositeLayers).toFile(outputPath);
}
