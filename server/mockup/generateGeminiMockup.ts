import fs from "fs";
import path from "path";
import sharp from "sharp";
import { logActivity, resolveActorFields } from "../activityLogger";
import { logger } from "../logger";
import { saveOutput } from "../objectStore";
import { cleanPlanePlate } from "./cleanPlate";
import { compositeSignOntoPhoto } from "./composite";
import { deterministicReferenceFallback } from "./deterministicFallback";
import { generateFullSceneMockup } from "./generateFullSceneMockup";
import { generateSignImage } from "./generateSignImage";
import { buildGlassDecalPanel } from "./glassDecalPanel";
import { extractSignMatte } from "./matte";
import {
  FLAT_APPLIED_SIGN_TYPES,
  GLASS_TREATMENT_TYPES,
  isFullSceneOnly,
  needsBackgroundMatte,
  usesGreyBoxPanel,
} from "./signTaxonomy";
import type { FewShotExample, MockupReference } from "./types";
import { makeOutputTempDir, resolveUploadFileAsync } from "./uploadCache";

export async function generateGeminiMockup(params: {
  canvasFilename?: string;
  logoFilename?: string;
  planePoints?: { x: number; y: number }[];
  tier: string;
  opportunityId: string;
  clientName: string;
  signType: string;
  signTypeDescription?: string;
  signTypeAttributes?: string[];
  generationNotes?: string;
  samplePrompt?: string;
  improvementGuidance?: string;
  promptBox?: string | null;
  selectedProducts?: string[];
  referenceFilenames?: string[];
  references?: MockupReference[];
  fewShotExamples?: FewShotExample[];
  estimatedDimensionsInches?: { width: number; height: number } | null;
  straightenToRect?: boolean;
  userId?: string | null;
  tenantId?: string | null;
}): Promise<string> {
  const {
    canvasFilename,
    logoFilename,
    planePoints,
    tier,
    opportunityId,
    clientName,
    signType,
    signTypeDescription,
    signTypeAttributes,
    generationNotes,
    samplePrompt,
    improvementGuidance,
    promptBox,
    selectedProducts = [],
    referenceFilenames,
    references,
    fewShotExamples,
    estimatedDimensionsInches,
    straightenToRect = true,
    userId,
    tenantId,
  } = params;

  const effectiveReferences: MockupReference[] =
    references ?? referenceFilenames?.map((filename) => ({ filename })) ?? [];
  const refFilenamesForLog = effectiveReferences.map((r) => r.filename);

  const outputDir = makeOutputTempDir(opportunityId);

  const canvasPath = canvasFilename ? await resolveUploadFileAsync(canvasFilename) : null;
  const fullSceneOnly = isFullSceneOnly(signType);
  const hasCanvas = !!canvasPath && !fullSceneOnly;
  const hasPlane = !fullSceneOnly && planePoints && planePoints.length >= 4;

  const signTypeFormatted = signType.replace(/_/g, " ").toLowerCase();

  if (fullSceneOnly) {
    logger.info(
      `[Gemini Mockup] Sign type ${signType} is full-scene-only — skipping composite path, generating full scene from references`
    );
  }

  if (hasCanvas && hasPlane && canvasPath) {
    const xs = planePoints.map((p) => p.x);
    const ys = planePoints.map((p) => p.y);
    const planeWidth = Math.round(Math.max(...xs) - Math.min(...xs));
    const planeHeight = Math.round(Math.max(...ys) - Math.min(...ys));
    logger.info(`[Gemini Mockup]   Plane dimensions: ${planeWidth}x${planeHeight}px`);

    // ────────────────────────────────────────────────────────────────────────
    // GREY-BOX DECAL PATH (Glass Wall Decal only)
    //
    // On real storefront glass the image model invents a framed interior scene instead of a
    // clean decal. For these types we skip BOTH Gemini calls (clean plate + sign render) and
    // deterministically build a flat opaque grey panel with the logo centered, then
    // perspective-warp it into the plane. The opaque panel fully covers the plane, so no clean
    // plate is needed. Fully deterministic, zero-cost, instant.
    // ────────────────────────────────────────────────────────────────────────
    if (usesGreyBoxPanel(signType)) {
      logger.info(
        `[Gemini Mockup] GREY-BOX DECAL: ${signTypeFormatted} | ${tier} | ${clientName} (deterministic — no Gemini)`
      );
      const greyBoxStart = Date.now();
      const signImageBuffer = await buildGlassDecalPanel({
        logoFilename,
        clientName,
        planeWidth: Math.max(planeWidth, 100),
        planeHeight: Math.max(planeHeight, 50),
      });

      const outputFilename = `mockup_${tier.toLowerCase()}_${Date.now()}.png`;
      const outputPath = path.join(outputDir, outputFilename);

      await compositeSignOntoPhoto({
        canvasPath,
        signImageBuffer,
        planePoints,
        outputPath,
        reflectionOpacity: 0, // flat opaque grey — no glass reflection overlay
      });

      logActivity({
        action: "mockup_generated",
        provider: "deterministic",
        model: "glass-decal-grey-box",
        status: "success",
        durationMs: Date.now() - greyBoxStart,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        ...(await resolveActorFields(userId, tenantId)),
        metadata: {
          clientName,
          signType,
          tier,
          opportunityId,
          pipeline: "glass-decal-grey-box-panel",
        },
      });

      await saveOutput(opportunityId, outputFilename, fs.readFileSync(outputPath), "image/png");
      logger.info(`[Gemini Mockup]   Grey-box decal complete — output saved: ${outputFilename}`);
      return outputFilename;
    }

    // ────────────────────────────────────────────────────────────────────────
    // SURGICAL COMPOSITE PATH (canvas + plane present)
    //
    // The output is the original photo with ONLY the sign inserted into the
    // selected plane. The sign is placed as a delta, not by saving a full AI
    // repaint:
    //   1. clean plate  — erase any existing signage in the plane, rebuild bare wall
    //   2. sign render  — generate the sign as its own element (on a chroma field
    //                     for matte types, so its negative space stays transparent)
    //   3. matte        — chroma-key the background out (matte types only)
    //   4. warp+composite — perspective-warp the sign into the exact plane quad on
    //                     the clean canvas; every pixel outside the quad is original
    //
    // straightenToRect only changes how the sign element is rendered (flat vs.
    // perspective) — the geometry comes from the plane quad either way (the route
    // pre-straightens the quad for straighten mode).
    // ────────────────────────────────────────────────────────────────────────
    logger.info(
      `[Gemini Mockup] SURGICAL COMPOSITE: ${signTypeFormatted} | ${tier} | ${clientName}`
    );
    logger.info(
      `[Gemini Mockup]   Canvas: ${canvasFilename}, Logo: ${logoFilename || "NONE"}, Refs: ${refFilenamesForLog.length}, straighten=${straightenToRect}`
    );

    const isGlassType = GLASS_TREATMENT_TYPES.has(signType);
    const isFlatApplied = FLAT_APPLIED_SIGN_TYPES.has(signType);
    // Only request a magenta chroma background for sign types with genuine negative space
    // (gaps between/around letters or sign elements that should reveal the real wall).
    // Fills-frame types (light box, acrylic standoff, menu board, glass, etc.) must NOT use
    // chroma: their semi-transparent panels, frosted surfaces, and chrome hardware absorb the
    // magenta and cause the matte to produce blurry panels and purple hardware blobs.
    const useMatte = needsBackgroundMatte(signType);

    const startTime = Date.now();

    // Clean plate and sign generation are independent — run them concurrently. Clean plate
    // never throws (returns null on failure); we keep the original canvas in that case.
    const cleanPlatePromise = cleanPlanePlate({ canvasPath, planePoints });

    let signImageBuffer: Buffer;
    let signUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let signModel = "gemini-3-pro-image-preview";
    let signProvider = "vertex-ai";
    try {
      const signResult = await generateSignImage({
        logoFilename,
        canvasPath,
        planePoints,
        tier,
        clientName,
        signType,
        signTypeDescription,
        signTypeAttributes,
        generationNotes,
        samplePrompt,
        improvementGuidance,
        promptBox,
        selectedProducts,
        references: effectiveReferences,
        fewShotExamples,
        planeWidth: Math.max(planeWidth, 100),
        planeHeight: Math.max(planeHeight, 50),
        estimatedDimensionsInches,
        straightenToRect,
        renderOnChroma: useMatte,
      });
      signImageBuffer = signResult.buffer;
      signUsage = signResult.usage;
      signModel = signResult.model;
      signProvider = signResult.provider;
    } catch (genErr: any) {
      // Make sure the in-flight clean-plate call is awaited/settled before bailing. Fold any
      // clean-plate tokens it consumed into the fallback log so cost stays accounted for.
      const cleanFail = await cleanPlatePromise.catch(() => null);
      logger.error(
        `[Gemini Mockup] Sign generation failed: ${genErr?.message ?? genErr} — engaging deterministic fallback`
      );
      logActivity({
        action: "mockup_generated",
        provider: "vertex-ai",
        model: "gemini-3-pro-image-preview",
        status: "fallback_deterministic",
        errorMessage: genErr?.message ?? String(genErr),
        durationMs: Date.now() - startTime,
        promptTokens: cleanFail?.usage.promptTokens ?? 0,
        completionTokens: cleanFail?.usage.completionTokens ?? 0,
        totalTokens: cleanFail?.usage.totalTokens ?? 0,
        ...(await resolveActorFields(userId, tenantId)),
        metadata: {
          clientName,
          signType,
          tier,
          opportunityId,
          pipeline: "surgical-composite-plane-guided",
          fewShotCount: fewShotExamples?.length ?? 0,
        },
      });
      return deterministicReferenceFallback({
        opportunityId,
        tier,
        signType,
        clientName,
        references: effectiveReferences,
        canvasFilename,
        logoFilename,
        planePoints,
      });
    }

    // Matte out the chroma field so the sign's negative space (between/inside letters and
    // around the sign body within the plane) stays transparent and reveals the real wall.
    // Always attempted: extractSignMatte self-skips when no magenta field is detected (e.g.
    // "fills-frame" sign types where the model legitimately ignores the chroma directive),
    // falling back to warping the trimmed image as-is.
    try {
      const matted = await extractSignMatte(signImageBuffer);
      if (matted) {
        signImageBuffer = matted;
        logger.info(`[Gemini Mockup]   Sign background matted (chroma key)`);
      } else {
        logger.warn(`[Gemini Mockup]   Chroma matte unavailable — warping trimmed sign as-is`);
      }
    } catch (matteErr: any) {
      logger.warn(
        `[Gemini Mockup]   Matte failed (${matteErr?.message ?? matteErr}) — warping trimmed sign as-is`
      );
    }

    // Trim transparent/background padding and fit to the plane bbox (preserves aspect, so the
    // sign is never stretched — aspect drift becomes transparent padding that falls through
    // to the original photo).
    if (!isGlassType) {
      try {
        const targetW = Math.max(planeWidth, 100);
        const targetH = Math.max(planeHeight, 50);
        const signMeta = await sharp(signImageBuffer).metadata();
        const genW = signMeta.width || targetW;
        const genH = signMeta.height || targetH;

        let trimmedBuffer: Buffer | null = null;

        if (signMeta.channels === 4 || signMeta.hasAlpha) {
          try {
            const candidate = await sharp(signImageBuffer).trim({ threshold: 15 }).toBuffer();
            const cm = await sharp(candidate).metadata();
            const tw = cm.width || genW;
            const th = cm.height || genH;
            if (tw < genW * 0.99 || th < genH * 0.99) {
              logger.info(`[Gemini Mockup]   Sign alpha-trim: ${genW}x${genH} → ${tw}x${th}`);
              trimmedBuffer = candidate;
            }
          } catch (_) {}
        }

        if (!trimmedBuffer) {
          try {
            const rawBuf = await sharp(signImageBuffer)
              .ensureAlpha()
              .raw()
              .toBuffer({ resolveWithObject: true });
            const { data, info } = rawBuf;
            let minX = info.width,
              minY = info.height,
              maxX = 0,
              maxY = 0;
            for (let y = 0; y < info.height; y++) {
              for (let x = 0; x < info.width; x++) {
                const a = data[(y * info.width + x) * 4 + 3];
                if (a > 20) {
                  if (x < minX) minX = x;
                  if (x > maxX) maxX = x;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                }
              }
            }
            const cw = maxX - minX + 1;
            const ch = maxY - minY + 1;
            if (cw > 10 && ch > 10 && (cw < genW * 0.99 || ch < genH * 0.99)) {
              logger.info(
                `[Gemini Mockup]   Sign content-bbox trim: ${genW}x${genH} → ${cw}x${ch}`
              );
              trimmedBuffer = await sharp(signImageBuffer)
                .extract({ left: minX, top: minY, width: cw, height: ch })
                .toBuffer();
            }
          } catch (_) {}
        }

        const sourceBuffer = trimmedBuffer || signImageBuffer;
        signImageBuffer = await sharp(sourceBuffer)
          .resize(targetW, targetH, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();
      } catch (trimErr: any) {
        logger.warn(`[Gemini Mockup]   Sign trim/resize failed (using as-is): ${trimErr.message}`);
      }
    }

    // Resolve the clean plate (or fall back to the original canvas) and warp the sign in.
    const cleanResult = await cleanPlatePromise;
    const cleanedBuf = cleanResult?.buffer;
    logger.info(
      cleanedBuf
        ? `[Gemini Mockup]   Clean plate applied (existing signage erased in plane)`
        : `[Gemini Mockup]   Clean plate unavailable — compositing onto original canvas`
    );

    const outputFilename = `mockup_${tier.toLowerCase()}_${Date.now()}.png`;
    const outputPath = path.join(outputDir, outputFilename);

    await compositeSignOntoPhoto({
      canvasPath,
      canvasBuffer: cleanedBuf ?? undefined,
      signImageBuffer,
      planePoints,
      outputPath,
      reflectionOpacity: isGlassType ? 0.22 : isFlatApplied ? 0.08 : 0,
    });

    // Aggregate token usage across both Gemini calls (sign render + clean plate) so the
    // single mockup row reflects the true cost of producing this mockup.
    const cleanUsage = cleanResult?.usage;
    logActivity({
      action: "mockup_generated",
      provider: signProvider,
      model: signModel,
      status: "success",
      durationMs: Date.now() - startTime,
      promptTokens: signUsage.promptTokens + (cleanUsage?.promptTokens ?? 0),
      completionTokens: signUsage.completionTokens + (cleanUsage?.completionTokens ?? 0),
      totalTokens: signUsage.totalTokens + (cleanUsage?.totalTokens ?? 0),
      ...(await resolveActorFields(userId, tenantId)),
      metadata: {
        clientName,
        signType,
        tier,
        opportunityId,
        pipeline: "surgical-composite-plane-guided",
        matted: useMatte,
        cleanPlate: !!cleanedBuf,
        fewShotCount: fewShotExamples?.length ?? 0,
      },
    });

    await saveOutput(opportunityId, outputFilename, fs.readFileSync(outputPath), "image/png");
    logger.info(`[Gemini Mockup]   Surgical composite complete — output saved: ${outputFilename}`);
    return outputFilename;
  } else {
    // ────────────────────────────────────────────────────────────────────────
    // NO-PLANE PATH — existing full-scene generator (unchanged)
    // ────────────────────────────────────────────────────────────────────────
    logger.info(`[Gemini Mockup] SINGLE-STEP: Generate full scene (no site photo or plane)`);
    logger.info(
      `[Gemini Mockup]   Tier: ${tier}, Sign type: ${signTypeFormatted}, Client: ${clientName}`
    );
    logger.info(
      `[Gemini Mockup]   Canvas: ${hasCanvas}, Logo: ${!!logoFilename}, Plane: ${!!hasPlane}`
    );
    logger.info(`[Gemini Mockup]   Reference images: ${refFilenamesForLog.length}`);

    return generateFullSceneMockup({
      ...params,
      improvementGuidance,
      references: effectiveReferences,
    });
  }
}
