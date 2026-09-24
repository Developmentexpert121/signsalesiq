import type {
  Asset,
  Opportunity,
  Plane,
  ProductRule,
  SignSpec,
  SignType,
  SignTypeReference,
} from "@shared/schema";
import { generateComposite } from "./compositeService";
import { generateGeminiMockup } from "./geminiMockupService";
import { generateComplianceText, generateRationale } from "./llmService";
import { selectReferences } from "./mockup/referenceUtils";
import type { FewShotExample } from "./mockup/types";
import { storage } from "./storage";

// Load curated few-shot pairs for a sign type. Capped at 2 (matches
// MAX_FEW_SHOT_EXAMPLES in the mockup service). Returns [] when nothing is seeded
// — the mockup service omits the few-shot block in that case.
export async function loadFewShotExamples(signType: string): Promise<FewShotExample[]> {
  const rows = await storage.getSignTypeExamples(signType, { limit: 2 });
  return rows.map((r) => ({
    inputText: r.exampleInput,
    outputFilename: r.exampleOutputFilename,
    label: r.label ?? undefined,
  }));
}

export function straightenPoints(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return [
    { x: Math.min(...xs), y: Math.min(...ys) },
    { x: Math.max(...xs), y: Math.min(...ys) },
    { x: Math.max(...xs), y: Math.max(...ys) },
    { x: Math.min(...xs), y: Math.max(...ys) },
  ];
}

// GOOD/BETTER/BEST tiers are no longer surfaced in the product; these values are
// carried through only because outputs.tier is NOT NULL and rules may still
// define per-tier products/sign types.
export interface TierPassThrough {
  tier: "GOOD" | "BETTER" | "BEST";
  products: string[];
  tierSignType: string | null;
}

export function getGenerationTiers(rule: ProductRule | undefined): TierPassThrough[] {
  const enabledTiers = rule?.enabledTiers ?? [];
  const allTiers: TierPassThrough[] = [
    {
      tier: "GOOD",
      products: rule?.goodProducts ?? ["Standard Option"],
      tierSignType: rule?.goodSignType || null,
    },
    {
      tier: "BETTER",
      products: rule?.betterProducts ?? ["Enhanced Option"],
      tierSignType: rule?.betterSignType || null,
    },
    {
      tier: "BEST",
      products: rule?.bestProducts ?? ["Premium Option"],
      tierSignType: rule?.bestSignType || null,
    },
  ];

  return enabledTiers.length > 0
    ? allTiers.filter((tier) => enabledTiers.includes(tier.tier))
    : [{ tier: "GOOD", products: [], tierSignType: null }];
}

export interface GenerationContext {
  spec: SignSpec;
  opp: Opportunity;
  canvasAsset: Asset | null;
  logoAsset: Asset | null;
  planeRaw: Plane | undefined;
  // planeRaw with points straightened when straightenToRect is set
  plane: Plane | undefined;
  rule: ProductRule | undefined;
  signTypeData: SignType | undefined;
  signRefs: SignTypeReference[];
  estimatedDimensionsInches: { width: number; height: number } | null;
  useAI: boolean;
  userId?: string;
}

export interface GenerationResult {
  baselinePath: string | null;
  aiMockupPath: string | null;
  rationale: string;
  compliance: string;
  aiFailureReason?: string;
}

// Loads everything generateOutputMockup needs that is shared across tiers of one
// sign spec: assets, plane, rule, sign type metadata, references, and the
// real-world dimension estimate derived from the plane's reference line.
export async function buildGenerationContext(
  spec: SignSpec,
  opp: Opportunity,
  opts: { useAI: boolean; userId?: string }
): Promise<GenerationContext> {
  const canvasAssetCandidate = spec.canvasAssetId
    ? ((await storage.getAsset(spec.canvasAssetId)) ?? null)
    : null;
  const logoAssetCandidate = spec.logoAssetId
    ? ((await storage.getAsset(spec.logoAssetId)) ?? null)
    : null;
  const canvasAsset =
    canvasAssetCandidate?.opportunityId === opp.id && canvasAssetCandidate.type === "CANVAS"
      ? canvasAssetCandidate
      : null;
  const specLogoAsset =
    logoAssetCandidate?.opportunityId === opp.id && logoAssetCandidate.type === "LOGO"
      ? logoAssetCandidate
      : null;
  const planeRaw = await storage.getPlaneBySignSpec(spec.id);
  const plane = planeRaw
    ? {
        ...planeRaw,
        points: planeRaw.straightenToRect ? straightenPoints(planeRaw.points) : planeRaw.points,
      }
    : undefined;

  const rule = await storage.findRule(
    spec.locationType,
    spec.signType,
    spec.budgetRange,
    opp.tenantId
  );
  const signRefs = await storage.getSignTypeReferences(spec.signType);
  const signTypeData = await storage.getSignTypeByName(spec.signType);

  let estimatedDimensionsInches: { width: number; height: number } | null = null;
  if (
    plane &&
    plane.referenceLine &&
    plane.referenceLengthInches &&
    plane.referenceLine.length === 2
  ) {
    const refPixelDist = Math.sqrt(
      (plane.referenceLine[1].x - plane.referenceLine[0].x) ** 2 +
        (plane.referenceLine[1].y - plane.referenceLine[0].y) ** 2
    );
    if (refPixelDist > 0) {
      const pixelsPerInch = refPixelDist / plane.referenceLengthInches;
      const xs = plane.points.map((p: any) => p.x);
      const ys = plane.points.map((p: any) => p.y);
      const planePixelW = Math.max(...xs) - Math.min(...xs);
      const planePixelH = Math.max(...ys) - Math.min(...ys);
      estimatedDimensionsInches = {
        width: planePixelW / pixelsPerInch,
        height: planePixelH / pixelsPerInch,
      };
    }
  }

  return {
    spec,
    opp,
    canvasAsset,
    logoAsset: specLogoAsset,
    planeRaw,
    plane,
    rule,
    signTypeData,
    signRefs,
    estimatedDimensionsInches,
    useAI: opts.useAI,
    userId: opts.userId,
  };
}

// Generates one output (baseline composite + AI mockup + rationale/compliance
// text) for a sign spec. Extracted from the per-tier loop of
// POST /api/sign-specs/:id/generate so single outputs can be regenerated in
// isolation (e.g. from user feedback) without wiping the spec's other outputs.
//
// `instanceImprovementGuidance` carries one-off corrections (user-flagged issues
// on the previous attempt). It is appended to the global per-sign-type guidance
// and flows into the prompt's "KNOWN ISSUES TO CORRECT" block.
export async function generateOutputMockup(
  ctx: GenerationContext,
  tierInfo: TierPassThrough,
  opts?: { instanceImprovementGuidance?: string; skipBaseline?: boolean }
): Promise<GenerationResult> {
  const { spec, opp, canvasAsset, logoAsset, plane, planeRaw, signTypeData, signRefs } = ctx;
  const { tier, products, tierSignType } = tierInfo;
  const hasCanvas = !!canvasAsset;
  const hasPlane = !!plane;

  const effectiveSignType = tierSignType || spec.signType;
  const effectiveSignTypeData = tierSignType
    ? await storage.getSignTypeByName(tierSignType)
    : signTypeData;
  const baseRefs = tierSignType ? await storage.getSignTypeReferences(tierSignType) : signRefs;
  const approvedExamplesForTier = await storage.getApprovedFeedbackImages(effectiveSignType, 2);
  const approvedFilenamesForTier = approvedExamplesForTier
    .filter((fb) => fb.generatedFilename)
    .map((fb) => fb.generatedFilename as string);
  const needsWorkForTier = await storage.getNeedsWorkSummary(effectiveSignType);
  const globalGuidance = (() => {
    const parts: string[] = [];
    if (needsWorkForTier.areas.length > 0)
      parts.push(`Fix these areas: ${needsWorkForTier.areas.join(", ")}`);
    if (needsWorkForTier.notes.length > 0)
      parts.push(`Reviewer notes: ${needsWorkForTier.notes.slice(0, 3).join(" | ")}`);
    return parts.length > 0 ? parts.join(". ") : undefined;
  })();
  const improvementGuidance =
    [globalGuidance, opts?.instanceImprovementGuidance].filter(Boolean).join(". ") || undefined;
  const effectiveReferences = selectReferences(baseRefs, approvedFilenamesForTier);
  const fewShotExamples = await loadFewShotExamples(effectiveSignType);

  let baselinePath: string | null = null;
  if (!opts?.skipBaseline && hasCanvas && hasPlane) {
    baselinePath = await generateComposite({
      opportunityId: opp.id,
      canvasFilename: canvasAsset?.filename,
      logoFilename: logoAsset?.filename ?? undefined,
      planePoints: plane.points,
      clientName: opp.clientName,
      signType: effectiveSignType,
      tier,
    });
  }

  let aiMockupPath: string | null = null;
  let aiFailureReason: string | undefined;
  if (ctx.useAI) {
    try {
      aiMockupPath = await generateGeminiMockup({
        opportunityId: opp.id,
        canvasFilename: hasCanvas ? canvasAsset?.filename : undefined,
        logoFilename: logoAsset?.filename ?? undefined,
        planePoints: hasPlane ? plane.points : undefined,
        signType: effectiveSignType,
        signTypeDescription: effectiveSignTypeData?.description ?? undefined,
        signTypeAttributes: (effectiveSignTypeData?.attributes as string[]) ?? undefined,
        generationNotes: effectiveSignTypeData?.generationNotes ?? undefined,
        samplePrompt: effectiveSignTypeData?.samplePrompt ?? undefined,
        improvementGuidance,
        clientName: opp.clientName,
        tier,
        userId: ctx.userId,
        tenantId: opp.tenantId,
        promptBox: spec.promptBox || undefined,
        selectedProducts: products.length > 0 ? products : undefined,
        references: effectiveReferences.length > 0 ? effectiveReferences : undefined,
        fewShotExamples: fewShotExamples.length > 0 ? fewShotExamples : undefined,
        estimatedDimensionsInches: ctx.estimatedDimensionsInches,
        straightenToRect: hasPlane ? (planeRaw?.straightenToRect ?? true) : undefined,
      });
    } catch (err: any) {
      const errStr = typeof err === "object" ? JSON.stringify(err) : String(err);
      const isRateLimit = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED");
      if (isRateLimit) {
        aiFailureReason =
          "Google Gemini AI is temporarily rate-limited due to high usage. This is not an app issue — Gemini limits how many image requests can be made per minute. Please wait about 5 minutes before trying again.";
      } else {
        aiFailureReason = `AI mockup generation failed: ${err.message || "Unknown error"}`;
      }
    }
  }

  const rationale = generateRationale({
    opportunity: opp,
    tier,
    selectedProducts: products,
    signTypeLabel: effectiveSignTypeData?.label,
  });
  const compliance = generateComplianceText({
    opportunity: opp,
    signCodeText: spec.signCodeText || opp.signCodeText,
  });

  return { baselinePath, aiMockupPath, rationale, compliance, aiFailureReason };
}
