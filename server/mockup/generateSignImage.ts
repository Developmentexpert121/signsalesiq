import { logger } from "../logger";
import {
  callGeminiWithRetry,
  type FewShotPair,
  type GeminiCallResult,
  MAX_FEW_SHOT_EXAMPLES,
  MAX_REFERENCE_IMAGES,
} from "./geminiClient";
import { sanitize } from "./prompts/sanitize";
import { buildSignPrompt } from "./prompts/signPrompt";
import { DIMENSIONAL_SIGN_TYPES, GLASS_TREATMENT_TYPES, getSignCategory } from "./signTaxonomy";
import type { FewShotExample, MockupReference } from "./types";
import { fileToBase64, resolveUploadFileAsync } from "./uploadCache";

export async function generateSignImage(params: {
  logoFilename?: string;
  canvasPath?: string | null;
  planePoints?: { x: number; y: number }[];
  tier: string;
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
  planeWidth: number;
  planeHeight: number;
  estimatedDimensionsInches?: { width: number; height: number } | null;
  straightenToRect?: boolean;
  // Render the sign on a flat pure-magenta field (for chroma-key matting) instead of baking
  // the site wall into the sign image. Used by the surgical-composite path for matte types.
  renderOnChroma?: boolean;
}): Promise<GeminiCallResult> {
  const {
    logoFilename,
    tier,
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
    planeWidth,
    planeHeight,
    estimatedDimensionsInches,
    straightenToRect = true,
    renderOnChroma = false,
  } = params;

  // Unified, primary-first reference list. Routes are expected to pass `references`
  // (ordered primary-first); legacy `referenceFilenames` is still accepted as a
  // back-compat fallback and lacks isPrimary/label metadata.
  const effectiveReferences: MockupReference[] =
    references ?? referenceFilenames?.map((filename) => ({ filename })) ?? [];
  const refFilenames = effectiveReferences.map((r) => r.filename);

  const hasRefs = refFilenames.length > 0;

  const resolvedLogoPath = logoFilename ? await resolveUploadFileAsync(logoFilename) : null;
  const hasLogo = !!resolvedLogoPath;

  const signCategory = getSignCategory(signType);
  const isDimensional = DIMENSIONAL_SIGN_TYPES.has(signType);
  const isGlassTreatment = GLASS_TREATMENT_TYPES.has(signType);

  // SURGICAL-COMPOSITE RENDER: never bake site imagery into the sign render. The clean-plate
  // canvas supplies the real background/lighting at composite time; attaching the building photo
  // (or a plane crop) here makes the image model reproduce the scene *inside* the sign — the
  // "inception" nesting once it is warped into the plane. Integration is handled downstream
  // (clean plate + perspective warp + reflection overlay) and via text-only lighting guidance.
  const hasSiteContext = false;
  const hasBuildingContext = false;
  logger.debug(
    `[Gemini Sign Gen] Surgical-composite: suppressing all site/building imagery from sign render (clean-plate supplies background)`
  );

  const prompt = buildSignPrompt({
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
    hasSiteContext,
    hasBuildingContext,
    planeWidth,
    planeHeight,
    estimatedDimensionsInches,
    straightenToRect,
    chromaBackground: renderOnChroma,
  });

  const signTypeFormatted = signType.replace(/_/g, " ").toLowerCase();
  const safeClientName = sanitize(clientName);
  logger.info(
    {
      tier,
      signType: signTypeFormatted,
      clientName: safeClientName,
      hasSiteContext,
      isDimensional,
    },
    "generating sign mockup"
  );
  if (promptBox && sanitize(promptBox).trim().length > 0) {
    logger.debug(`[Gemini Sign Gen]   Client creative brief: "${promptBox}"`);
  }

  const parts: any[] = [];
  parts.push({ text: prompt });

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

  // Few-shot calibration pairs (curated golden input-spec + accepted-output pairs).
  // Placed AFTER the real task inputs (site / logo) and BEFORE the references so the
  // model reads: "what to make → what this job's branding is → output like this → using
  // construction from these refs". Resolves to concrete file paths once so the fallback
  // path can re-use them.
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
        `[Gemini Sign Gen]   Loaded ${loadedPairs.length}/${pairsToLoad.length} few-shot example pairs (capped at ${MAX_FEW_SHOT_EXAMPLES})`
      );
    }
  }

  const resolvedRefPaths: string[] = [];
  if (hasRefs) {
    let loadedRefCount = 0;
    const refsToLoad = effectiveReferences.slice(0, MAX_REFERENCE_IMAGES);
    const hasPrimaryRef = refsToLoad.some((r) => r.isPrimary);
    parts.push({
      text: `\n\n[SIGN REFERENCES — AUTHORITATIVE FOR CONSTRUCTION]\nThese photographs are the GROUND TRUTH for how this sign type is physically built. You MUST match the construction method, material & finish, 3D form and depth, proportions, mounting hardware, and illumination shown. ${
        hasPrimaryRef
          ? "Treat REFERENCE 1 (PRIMARY) as the single most authoritative example — the fabricated sign body must look like it came from the same shop using the same technique."
          : "All references below are equally authoritative — match the construction method, material & finish, 3D form, and illumination shown across them."
      }\n\nSTRICT SEPARATION OF CONCERNS: copy ONLY physical construction/material/form/illumination from these images. ALL branding — company name, logo, colors, text, graphics — comes EXCLUSIVELY from [CLIENT LOGO] and the supplied company name, NEVER from these references. Do NOT reproduce, trace, or imitate any logo, lettering, mascot, character, or artwork visible on the reference signs; they belong to other companies. Picture the references as the empty fabricated sign body; apply the client's branding onto that body.

DO NOT COPY BACKGROUNDS OR ENVIRONMENT FROM THESE REFERENCES: the wall, brick, stucco, siding, sky, foliage, street, parking lot, lighting, and any other surroundings shown in the reference photos belong to other locations and MUST NOT appear in your output. Use the references purely as construction studies for the sign body itself; everything around the sign must come from the chroma/background instruction above, not from these reference photos.`,
    });
    for (let i = 0; i < refsToLoad.length; i++) {
      const ref = refsToLoad[i];
      const refPath = await resolveUploadFileAsync(ref.filename);
      if (refPath) {
        resolvedRefPaths.push(refPath);
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
      `[Gemini Sign Gen]   Loaded ${loadedRefCount}/${refsToLoad.length} reference images (capped at ${MAX_REFERENCE_IMAGES}${hasPrimaryRef ? ", starred-only" : ", no starred refs — using all"})`
    );
  }

  return callGeminiWithRetry(parts, 3, {
    textPrompt: prompt,
    logoPath: resolvedLogoPath,
    referenceFilePaths: resolvedRefPaths,
    fewShotPairs: resolvedFewShotPairs,
  });
}

// re-export for downstream taxonomy checks where the orchestrator was inlining them
export { DIMENSIONAL_SIGN_TYPES, GLASS_TREATMENT_TYPES, getSignCategory };
