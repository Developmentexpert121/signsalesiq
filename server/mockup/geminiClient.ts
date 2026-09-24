import { GoogleGenAI, Modality } from "@google/genai";
import fs from "fs";
import path from "path";
import { env } from "../env";
import { logger } from "../logger";

export const MAX_REFERENCE_IMAGES = 4;
export const MAX_FEW_SHOT_EXAMPLES = 2;

const directApiKey = env.VERTEX_API_KEY ?? env.GOOGLE_API_KEY;

const ai = directApiKey ? new GoogleGenAI({ apiKey: directApiKey }) : null;

const isProduction = env.NODE_ENV === "production";
const hasReplitProxy =
  !!env.AI_INTEGRATIONS_GEMINI_API_KEY && !!env.AI_INTEGRATIONS_GEMINI_BASE_URL;
// Fallback is enabled whenever both proxy env vars are set. Previously this was gated on
// (isReplitEnv || !isProduction), which silently disabled the fallback on non-Replit prod
// deploys (e.g. DigitalOcean) — the operator is responsible for only setting the proxy URL
// where it is actually reachable.
const enableFallback = hasReplitProxy;
const fallbackAi = enableFallback
  ? new GoogleGenAI({
      apiKey: env.AI_INTEGRATIONS_GEMINI_API_KEY,
      httpOptions: {
        apiVersion: "",
        baseUrl: env.AI_INTEGRATIONS_GEMINI_BASE_URL,
      },
    })
  : null;

if (!ai && !fallbackAi) {
  logger.warn(
    "[Gemini] WARNING: No AI API keys configured. AI mockup generation will not work. Set VERTEX_API_KEY or GOOGLE_API_KEY."
  );
} else if (!ai && isProduction) {
  logger.warn(
    "[Gemini] WARNING: No direct API key (VERTEX_API_KEY/GOOGLE_API_KEY) in production. Relying on AI_INTEGRATIONS_GEMINI fallback."
  );
} else if (enableFallback) {
  logger.debug("[Gemini] Secondary fallback path enabled (AI_INTEGRATIONS_GEMINI_*).");
}

const FALLBACK_MODELS = [
  "gemini-3-pro-image-preview",
  "gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image",
];

export const DEFAULT_MOCKUP_MODEL = "gemini-3-pro-image-preview";

// Curated list of known image-generation models surfaced in the admin selector.
// The @google/genai SDK types `model` as an open string, so the admin may also
// enter a custom value — this list is just the convenience dropdown.
export const KNOWN_MOCKUP_MODELS = [
  "gemini-3-pro-image-preview",
  "gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image",
];

// Active primary model for mockup generation. Initialized from the persisted
// mockup_settings row at server startup and updated in-memory when a super admin
// saves a new selection, so changes take effect without a restart.
let activeMockupModel = DEFAULT_MOCKUP_MODEL;

export function getActiveMockupModel(): string {
  return activeMockupModel;
}

export function setActiveMockupModel(model: string): void {
  if (model?.trim()) activeMockupModel = model.trim();
}

// Per-attempt wall-clock limit. The Gemini SDK has no usable default timeout, so a
// hung request would otherwise stall until the HTTP layer kills the whole request.
// Fast-fail here so the existing retry/backoff (and the secondary path) can engage.
const GEMINI_ATTEMPT_TIMEOUT_MS = 75_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handle = setTimeout(() => {
      // Include "timeout" + "DEADLINE_EXCEEDED" so callGeminiWithRetry's isTimeout
      // detection (errMsg.includes("timeout") || "DEADLINE_EXCEEDED") routes this
      // into the existing backoff/retry path automatically.
      reject(new Error(`[${label}] timeout after ${ms}ms (DEADLINE_EXCEEDED — per-attempt limit)`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(handle);
        resolve(v);
      },
      (e) => {
        clearTimeout(handle);
        reject(e);
      }
    );
  });
}

export interface FewShotPair {
  inputText: string;
  outputPath: string;
}

export interface GeminiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GeminiCallResult {
  buffer: Buffer;
  usage: GeminiUsage;
  model: string;
  provider: string;
}

function extractUsage(response: any): GeminiUsage {
  const u = response?.usageMetadata ?? {};
  const promptTokens = u.promptTokenCount ?? 0;
  const completionTokens = u.candidatesTokenCount ?? 0;
  const totalTokens = u.totalTokenCount ?? promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

async function callGeminiFallbackImageGeneration(
  prompt: string,
  logoPath?: string | null,
  referenceFilePaths?: string[],
  fewShotPairs?: FewShotPair[]
): Promise<GeminiCallResult> {
  if (!fallbackAi) {
    throw new Error("No fallback AI key configured (AI_INTEGRATIONS_GEMINI_API_KEY not available)");
  }
  logger.debug(`[Gemini Fallback] Generating image with AI_INTEGRATIONS_GEMINI_API_KEY...`);

  const parts: any[] = [{ text: prompt }];

  // Few-shot pairs go before refs so the calibration anchors what the model sees
  // *after* the prompt but *before* the construction references.
  const pairsToSend = (fewShotPairs ?? []).slice(0, MAX_FEW_SHOT_EXAMPLES);
  for (let i = 0; i < pairsToSend.length; i++) {
    const pair = pairsToSend[i];
    parts.push({ text: `\n\n[EXAMPLE ${i + 1} — INPUT SPEC]\n${pair.inputText}` });
    parts.push({ text: `\n\n[EXAMPLE ${i + 1} — ACCEPTED OUTPUT]` });
    try {
      const data = fs.readFileSync(pair.outputPath);
      const ext = path.extname(pair.outputPath).toLowerCase();
      let mimeType = "image/png";
      if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
      else if (ext === ".webp") mimeType = "image/webp";
      parts.push({ inlineData: { mimeType, data: data.toString("base64") } });
    } catch (err: any) {
      logger.info(
        `[Gemini Fallback] Could not read few-shot output ${pair.outputPath}: ${err.message}`
      );
    }
  }

  const imageFiles: string[] = [];
  if (logoPath) imageFiles.push(logoPath);
  if (referenceFilePaths) {
    // Primary-first ordering is set by the routes / generateSignImage caller, so
    // slicing here keeps the most important refs (primary first).
    for (const refPath of referenceFilePaths.slice(0, MAX_REFERENCE_IMAGES)) {
      imageFiles.push(refPath);
    }
  }

  for (const filePath of imageFiles) {
    try {
      const fileData = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = "image/png";
      if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
      else if (ext === ".webp") mimeType = "image/webp";

      parts.push({
        inlineData: {
          mimeType,
          data: fileData.toString("base64"),
        },
      });
    } catch (err: any) {
      logger.info(`[Gemini Fallback] Could not read file ${filePath}: ${err.message}`);
    }
  }

  let lastError: any;
  // Try the active (admin-selected) model first so the selection is honored on
  // the proxy path too, then fall through to the remaining static fallbacks.
  const active = getActiveMockupModel();
  const modelsToTry = [active, ...FALLBACK_MODELS.filter((m) => m !== active)];
  for (const model of modelsToTry) {
    try {
      logger.debug(`[Gemini Fallback] Trying model: ${model}...`);
      const response = await withTimeout(
        fallbackAi.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
            maxOutputTokens: 8192,
          },
        }),
        GEMINI_ATTEMPT_TIMEOUT_MS,
        `Gemini Fallback ${model}`
      );

      const candidate = response.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);

      if (!imagePart?.inlineData?.data) {
        throw new Error(`No image generated by ${model}`);
      }

      logger.debug(`[Gemini Fallback] Image generated successfully via ${model}`);
      return {
        buffer: Buffer.from(imagePart.inlineData.data, "base64"),
        usage: extractUsage(response),
        model,
        provider: "vertex-ai-proxy",
      };
    } catch (err: any) {
      lastError = err;
      const errMsg = typeof err === "object" ? JSON.stringify(err) : String(err);
      logger.debug(`[Gemini Fallback] ${model} failed: ${errMsg.substring(0, 150)}`);
    }
  }

  throw lastError || new Error("All Gemini fallback models failed");
}

export interface CallWithFallbackOptions {
  textPrompt: string;
  logoPath?: string | null;
  referenceFilePaths?: string[];
  fewShotPairs?: FewShotPair[];
}

export async function callGeminiWithRetry(
  parts: any[],
  maxRetries = 3,
  fallbackOptions?: CallWithFallbackOptions
): Promise<GeminiCallResult> {
  if (!ai) {
    if (fallbackOptions) {
      logger.info(`[Gemini] No primary AI key configured, going directly to fallback...`);
      return callGeminiFallbackImageGeneration(
        fallbackOptions.textPrompt,
        fallbackOptions.logoPath,
        fallbackOptions.referenceFilePaths,
        fallbackOptions.fewShotPairs
      );
    }
    throw new Error("No AI API keys configured. Set VERTEX_API_KEY or GOOGLE_API_KEY.");
  }

  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const primaryModel = getActiveMockupModel();
      const response = await withTimeout(
        ai.models.generateContent({
          model: primaryModel,
          contents: [{ role: "user", parts }],
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
            maxOutputTokens: 8192,
          },
        }),
        GEMINI_ATTEMPT_TIMEOUT_MS,
        `Gemini primary attempt ${attempt}/${maxRetries}`
      );

      const candidate = response.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);

      if (!imagePart?.inlineData?.data) {
        throw new Error("No image generated by Gemini");
      }

      return {
        buffer: Buffer.from(imagePart.inlineData.data, "base64"),
        usage: extractUsage(response),
        model: primaryModel,
        provider: "vertex-ai",
      };
    } catch (err: any) {
      lastError = err;
      const errMsg = typeof err === "object" ? JSON.stringify(err) : String(err);
      const isRateLimit =
        errMsg.includes("429") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("Resource exhausted");
      const isTimeout =
        errMsg.includes("timeout") ||
        errMsg.includes("DEADLINE_EXCEEDED") ||
        errMsg.includes("ETIMEDOUT") ||
        errMsg.includes("ECONNRESET") ||
        errMsg.includes("socket hang up");
      const isNoImage = errMsg.includes("No image generated");
      if ((isRateLimit || isTimeout || isNoImage) && attempt < maxRetries) {
        const delayMs = Math.min(1000 * 2 ** attempt + Math.random() * 500, 30_000);
        logger.debug(
          `[Gemini] ${isTimeout ? "Timeout" : isRateLimit ? "Rate limited" : "Empty image response"} (attempt ${attempt}/${maxRetries}), retrying in ${(delayMs / 1000).toFixed(1)}s...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      break;
    }
  }

  if (fallbackOptions) {
    const primaryMsg =
      typeof lastError === "object" ? JSON.stringify(lastError) : String(lastError);
    logger.info(`[Gemini] All retries exhausted. Error: ${primaryMsg.substring(0, 200)}`);
    logger.info(`[Gemini → Gemini Fallback] Falling back to AI_INTEGRATIONS_GEMINI_API_KEY...`);
    try {
      return await callGeminiFallbackImageGeneration(
        fallbackOptions.textPrompt,
        fallbackOptions.logoPath,
        fallbackOptions.referenceFilePaths,
        fallbackOptions.fewShotPairs
      );
    } catch (fallbackErr: any) {
      const fallbackMsg = fallbackErr?.message ?? String(fallbackErr);
      logger.error(`[Gemini Fallback] Also failed: ${fallbackMsg}`);
      // Aggregate so the route's user-facing aiFailureReason reflects the real cause.
      // Keep 429 / RESOURCE_EXHAUSTED tokens from either layer so rate-limit detection
      // in sign-specs.routes.ts continues to match.
      const aggregated = new Error(
        `Primary: ${primaryMsg.substring(0, 300)} | Fallback: ${String(fallbackMsg).substring(0, 300)}`
      );
      (aggregated as any).cause = fallbackErr;
      throw aggregated;
    }
  }

  throw lastError || new Error("Gemini generation failed after retries");
}
