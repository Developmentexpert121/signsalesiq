import { GoogleGenAI } from "@google/genai";
import { env } from "./env";

import { logger } from "./logger";
const isReplitEnv = !!env.REPL_ID;

let _ai: GoogleGenAI | null = null;
export function getAI(): GoogleGenAI | null {
  if (!_ai) {
    const directKey = env.VERTEX_API_KEY ?? env.GOOGLE_API_KEY;
    const replitKey = env.AI_INTEGRATIONS_GEMINI_API_KEY;
    const replitBase = env.AI_INTEGRATIONS_GEMINI_BASE_URL;

    // Only use the Replit proxy when actually running inside Replit.
    // On DO App Platform the base URL points to localhost:1106 which doesn't exist there.
    if (isReplitEnv && replitKey && replitBase) {
      _ai = new GoogleGenAI({
        apiKey: replitKey,
        httpOptions: { apiVersion: "", baseUrl: replitBase },
      });
    } else if (directKey) {
      _ai = new GoogleGenAI({ apiKey: directKey });
    } else {
      return null;
    }
  }
  return _ai;
}

function resetAI() {
  _ai = null;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function lookupSignCode(params: {
  address: string;
  signType: string;
  signTypeLabel?: string;
}): Promise<string> {
  const { address, signType, signTypeLabel } = params;
  const signLabel =
    signTypeLabel || signType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const prompt = `You are a signage compliance expert. Look up the local sign code and bylaws for the city/town at "${address}" as they relate to ${signLabel} signs.

Provide a concise, actionable summary covering ONLY these key points:

**Jurisdiction & Bylaw Reference**
City/town, relevant sign code chapter/section number

**Permit Requirements**
Permit type needed, approvals required, estimated fees

**${signLabel} Size & Placement Limits**
Max sign area (sq ft), max height, projection limits, number of signs allowed per facade. Note how sign area is calculated (e.g. per linear foot of frontage).

**Illumination Rules**
Whether illuminated signs are allowed, any brightness/hours restrictions for ${signLabel}

**Key Restrictions**
Zoning district considerations, historic district rules, setback requirements - only if applicable to this address

**Permitting Contact**
Department name, phone number if known

RULES:
- Be specific to THIS municipality - cite actual bylaw sections when possible
- Use bullet points, keep each section to 2-4 bullets max
- Include specific numbers (sq ft, heights, distances) where known
- Mark uncertain specifics with "(verify with municipality)"
- End with a one-line disclaimer to confirm with local building department
- Keep the entire response under 400 words`;

  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const ai = getAI();
    if (!ai) {
      throw new Error("AI service is not configured. Please contact your administrator.");
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const text =
        response.candidates?.[0]?.content?.parts
          ?.filter((p: any) => p.text)
          .map((p: any) => p.text)
          .join("") ?? "";

      if (!text) {
        throw new Error("No sign code information returned from AI");
      }

      return text;
    } catch (err: any) {
      lastError = err;
      const isNetworkError =
        err.message?.includes("fetch failed") ||
        err.message?.includes("ECONNRESET") ||
        err.message?.includes("ETIMEDOUT") ||
        err.message?.includes("ENOTFOUND") ||
        err.code === "ECONNRESET";

      if (isNetworkError) {
        logger.warn(`[SignCode] Network error on attempt ${attempt}/${maxRetries}: ${err.message}`);
        resetAI();
        if (attempt < maxRetries) {
          await sleep(1500 * attempt);
          continue;
        }
      }
      break;
    }
  }

  throw lastError;
}
