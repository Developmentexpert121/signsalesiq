import sharp from "sharp";
import { generateComposite } from "../compositeService";
import { logger } from "../logger";
import { saveOutput } from "../objectStore";
import { resolveUploadFileAsync } from "./uploadCache";
import type { MockupReference } from "./types";

// Last-resort, non-LLM output. Honors the "reference images are the source of truth"
// contract: when all AI attempts have failed, we save the sign type's primary reference
// image as the mockup. If no primary reference is available we fall back to the
// deterministic generateComposite (logo/tier box on the site photo). Only throws when
// neither path is possible.
export async function deterministicReferenceFallback(opts: {
  opportunityId: string;
  tier: string;
  signType: string;
  clientName: string;
  references: MockupReference[];
  canvasFilename?: string;
  logoFilename?: string;
  planePoints?: { x: number; y: number }[];
}): Promise<string> {
  const { opportunityId, tier, signType, references } = opts;
  const primary = references.find((r) => r.isPrimary) ?? references[0];
  if (primary) {
    const refPath = await resolveUploadFileAsync(primary.filename);
    if (refPath) {
      const outputFilename = `mockup_${tier.toLowerCase()}_${Date.now()}.png`;
      // Normalize to PNG so downstream consumers (UI, baseline image diffing) get a
      // predictable mime type even when the reference was webp/jpeg.
      const pngBuffer = await sharp(refPath).png().toBuffer();
      await saveOutput(opportunityId, outputFilename, pngBuffer, "image/png");
      logger.warn(
        `[Gemini Mockup] DETERMINISTIC FALLBACK (raw reference) — signType=${signType}, ref=${primary.filename}, tier=${tier}`
      );
      return outputFilename;
    }
  }
  if (opts.canvasFilename && opts.planePoints && opts.planePoints.length >= 4) {
    logger.warn(
      `[Gemini Mockup] DETERMINISTIC FALLBACK (baseline composite) — no primary reference for signType=${signType}, tier=${tier}`
    );
    return generateComposite({
      opportunityId,
      canvasFilename: opts.canvasFilename,
      logoFilename: opts.logoFilename,
      planePoints: opts.planePoints,
      clientName: opts.clientName,
      signType,
      tier,
    });
  }
  throw new Error(
    `No deterministic fallback available for ${signType} (no primary reference and no site photo + plane)`
  );
}
