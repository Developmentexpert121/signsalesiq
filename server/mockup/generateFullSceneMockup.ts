import sharp from "sharp";
import { logActivity, resolveActorFields } from "../activityLogger";
import { logger } from "../logger";
import { saveOutput } from "../objectStore";
import { deterministicReferenceFallback } from "./deterministicFallback";
import {
  callGeminiWithRetry,
  MAX_FEW_SHOT_EXAMPLES,
  MAX_REFERENCE_IMAGES,
  type FewShotPair,
} from "./geminiClient";
import { buildFullScenePromptAssembled } from "./prompts/fullScenePrompt";
import type { FewShotExample, MockupReference } from "./types";
import { fileToBase64, resolveUploadFileAsync } from "./uploadCache";
import { normalizeExifOrientation } from "./imageOps";

export async function generateFullSceneMockup(params: {
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
  userId?: string | null;
  tenantId?: string | null;
}): Promise<string> {
  const {
    canvasFilename,
    logoFilename,
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
    userId,
    tenantId,
  } = params;

  const effectiveReferences: MockupReference[] =
    references ?? referenceFilenames?.map((filename) => ({ filename })) ?? [];
  const refFilenames = effectiveReferences.map((r) => r.filename);

  const hasRefs = refFilenames.length > 0;

  const resolvedLogoPath = logoFilename ? await resolveUploadFileAsync(logoFilename) : null;
  const hasLogo = !!resolvedLogoPath;

  const resolvedCanvasPath = canvasFilename ? await resolveUploadFileAsync(canvasFilename) : null;
  const hasSitePhoto = !!resolvedCanvasPath;

  const prompt = buildFullScenePromptAssembled({
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
    hasRefs,
    hasLogo,
    hasSitePhoto,
  });

  const parts: any[] = [];
  parts.push({ text: prompt });

  if (hasSitePhoto && resolvedCanvasPath) {
    const normalizedCanvasBuf = await normalizeExifOrientation(resolvedCanvasPath);
    parts.push({ text: "\n\n[SITE PHOTO]" });
    parts.push({
      inlineData: {
        data: normalizedCanvasBuf.toString("base64"),
        mimeType: "image/png",
      },
    });
  }

  if (hasLogo && resolvedLogoPath) {
    const logoData = fileToBase64(resolvedLogoPath);
    parts.push({
      text: "\n\n[CLIENT LOGO — reproduce EXACTLY as-is. Keep the logo's ORIGINAL COLORS (no recolor, tint, hue/saturation shift, or monochrome conversion) and its uploaded proportions (no stretch, skew, or distortion). This logo already contains the company wordmark, so do NOT also render the company name as separate text unless the client design brief explicitly asks for it.]",
    });
    parts.push({
      inlineData: {
        data: logoData.base64,
        mimeType: logoData.mimeType,
      },
    });
  }

  const resolvedFewShotPairs: FewShotPair[] = [];
  if (fewShotExamples && fewShotExamples.length > 0) {
    const pairsToLoad = fewShotExamples.slice(0, MAX_FEW_SHOT_EXAMPLES);
    const loadedPairs: { example: FewShotExample; path: string }[] = [];
    for (const ex of pairsToLoad) {
      const outPath = await resolveUploadFileAsync(ex.outputFilename);
      if (outPath) loadedPairs.push({ example: ex, path: outPath });
    }
    if (loadedPairs.length > 0) {
      parts.push({
        text: `\n\n[FEW-SHOT EXAMPLES — accepted outputs for this sign type]\nThe following pairs show example input specs and the accepted output for this exact sign type. Treat them as the calibration target: when the real task below is similar, produce output of the same type, construction, finish, and quality. Do NOT copy branding, text, logos, or company names from any example — branding comes only from [CLIENT LOGO] and the supplied company name.`,
      });
      for (let i = 0; i < loadedPairs.length; i++) {
        const { example, path: outPath } = loadedPairs[i];
        const outData = fileToBase64(outPath);
        parts.push({ text: `\n\n[EXAMPLE ${i + 1} — INPUT SPEC]\n${example.inputText}` });
        parts.push({
          text: `\n\n[EXAMPLE ${i + 1} — ACCEPTED OUTPUT${example.label ? ` — ${example.label}` : ""}]`,
        });
        parts.push({
          inlineData: { data: outData.base64, mimeType: outData.mimeType },
        });
        resolvedFewShotPairs.push({ inputText: example.inputText, outputPath: outPath });
      }
      parts.push({
        text: "\n\n[REAL TASK FOLLOWS — apply the same construction quality to the inputs below.]",
      });
      logger.info(
        `[Gemini Mockup]   Loaded ${loadedPairs.length}/${pairsToLoad.length} few-shot example pairs (capped at ${MAX_FEW_SHOT_EXAMPLES})`
      );
    }
  }

  if (hasRefs) {
    let loadedRefCount = 0;
    const refsToLoad = effectiveReferences.slice(0, MAX_REFERENCE_IMAGES);
    parts.push({
      text: `\n\n[SIGN REFERENCES — AUTHORITATIVE FOR CONSTRUCTION]\nThese photographs are the GROUND TRUTH for how this sign type is physically built. You MUST match the construction method, material & finish, 3D form and depth, proportions, mounting hardware, and illumination shown. Treat REFERENCE 1 (PRIMARY) as the single most authoritative example — the fabricated sign body must look like it came from the same shop using the same technique.\n\nSTRICT SEPARATION OF CONCERNS: copy ONLY physical construction/material/form/illumination from these images. ALL branding — company name, logo, colors, text, graphics — comes EXCLUSIVELY from [CLIENT LOGO] and the supplied company name, NEVER from these references. Do NOT reproduce, trace, or imitate any logo, lettering, mascot, character, or artwork visible on the reference signs; they belong to other companies. Picture the references as the empty fabricated sign body; apply the client's branding onto that body.`,
    });
    for (let i = 0; i < refsToLoad.length; i++) {
      const ref = refsToLoad[i];
      const refPath = await resolveUploadFileAsync(ref.filename);
      if (refPath) {
        const refData = fileToBase64(refPath);
        const labelParts = [`REFERENCE ${i + 1}`];
        if (ref.isPrimary) labelParts.push("PRIMARY");
        if (ref.label) labelParts.push(ref.label);
        parts.push({ text: `\n\n[${labelParts.join(" — ")}]` });
        parts.push({
          inlineData: {
            data: refData.base64,
            mimeType: refData.mimeType,
          },
        });
        loadedRefCount++;
      }
    }
    logger.info(
      `[Gemini Mockup]   Loaded ${loadedRefCount}/${refsToLoad.length} reference images (capped at ${MAX_REFERENCE_IMAGES}, primary first)`
    );
  }

  const resolvedRefPaths: string[] = [];
  if (hasRefs) {
    for (const refFilename of refFilenames.slice(0, MAX_REFERENCE_IMAGES)) {
      const refPath = await resolveUploadFileAsync(refFilename);
      if (refPath) resolvedRefPaths.push(refPath);
    }
  }

  const startTime = Date.now();
  let imageBuffer: Buffer;
  let usedModel = "gemini-3-pro-image-preview";
  let usedProvider = "vertex-ai";

  try {
    const imageResult = await callGeminiWithRetry(parts, 3, {
      textPrompt: prompt,
      logoPath: resolvedLogoPath,
      referenceFilePaths: resolvedRefPaths,
      fewShotPairs: resolvedFewShotPairs,
    });
    imageBuffer = imageResult.buffer;
    usedModel = imageResult.model;
    usedProvider = imageResult.provider;

    logActivity({
      action: "mockup_generated",
      provider: usedProvider,
      model: usedModel,
      status: "success",
      durationMs: Date.now() - startTime,
      promptTokens: imageResult.usage.promptTokens,
      completionTokens: imageResult.usage.completionTokens,
      totalTokens: imageResult.usage.totalTokens,
      ...(await resolveActorFields(userId, tenantId)),
      metadata: {
        clientName,
        signType,
        tier,
        opportunityId,
        fewShotCount: resolvedFewShotPairs.length,
      },
    });
  } catch (err: any) {
    // All AI attempts exhausted in the single-step path. Fall back to a deterministic
    // output (raw primary reference image when available, baseline composite otherwise)
    // so the user always sees something. See plan §1.4.
    logger.error(
      `[Gemini Mockup] generateFullSceneMockup failed: ${err?.message ?? err} — engaging deterministic fallback`
    );
    logActivity({
      action: "mockup_generated",
      provider: usedProvider,
      model: usedModel,
      status: "fallback_deterministic",
      errorMessage: err?.message ?? String(err),
      durationMs: Date.now() - startTime,
      ...(await resolveActorFields(userId, tenantId)),
      metadata: {
        clientName,
        signType,
        tier,
        opportunityId,
        pipeline: "single-step",
        fewShotCount: resolvedFewShotPairs.length,
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
      planePoints: params.planePoints,
    });
  }

  const outputFilename = `mockup_${tier.toLowerCase()}_${Date.now()}.png`;

  const pngOutputBuffer = await sharp(imageBuffer).png().toBuffer();
  await saveOutput(opportunityId, outputFilename, pngOutputBuffer, "image/png");

  return outputFilename;
}
