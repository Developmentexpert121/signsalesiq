import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateComposite: vi.fn(),
  generateGeminiMockup: vi.fn(),
  generateComplianceText: vi.fn(),
  generateRationale: vi.fn(),
  selectReferences: vi.fn(),
  storage: {
    findRule: vi.fn(),
    getApprovedFeedbackImages: vi.fn(),
    getAsset: vi.fn(),
    getNeedsWorkSummary: vi.fn(),
    getPlaneBySignSpec: vi.fn(),
    getSignTypeByName: vi.fn(),
    getSignTypeExamples: vi.fn(),
    getSignTypeReferences: vi.fn(),
  },
}));

vi.mock("./compositeService", () => ({ generateComposite: mocks.generateComposite }));
vi.mock("./geminiMockupService", () => ({
  generateGeminiMockup: mocks.generateGeminiMockup,
}));
vi.mock("./llmService", () => ({
  generateComplianceText: mocks.generateComplianceText,
  generateRationale: mocks.generateRationale,
}));
vi.mock("./mockup/referenceUtils", () => ({ selectReferences: mocks.selectReferences }));
vi.mock("./storage", () => ({ storage: mocks.storage }));

import {
  buildGenerationContext,
  generateOutputMockup,
  type GenerationContext,
} from "./mockupGenerationService";

const opportunity = {
  id: "opp-1",
  ownerId: "user-1",
  tenantId: "tenant-1",
  clientName: "Acme",
  address: "123 Main St",
  promptBox: "FIRST SIGN LEGACY INSTRUCTIONS",
} as any;

function makeSpec(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    opportunityId: opportunity.id,
    canvasAssetId: null,
    logoAssetId: null,
    signType: "CHANNEL_LETTERS",
    locationType: "EXTERIOR",
    budgetRange: "5000_10000",
    signDuration: "PERMANENT",
    targetAudience: "BRAND",
    readDistanceFt: null,
    showSignCode: false,
    signCodeText: null,
    promptBox: null,
    sortOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.storage.findRule.mockResolvedValue(undefined);
  mocks.storage.getPlaneBySignSpec.mockResolvedValue(undefined);
  mocks.storage.getSignTypeByName.mockResolvedValue({
    name: "CHANNEL_LETTERS",
    label: "Channel Letters",
  });
  mocks.storage.getSignTypeReferences.mockResolvedValue([]);
  mocks.storage.getApprovedFeedbackImages.mockResolvedValue([]);
  mocks.storage.getNeedsWorkSummary.mockResolvedValue({ areas: [], notes: [] });
  mocks.storage.getSignTypeExamples.mockResolvedValue([]);
  mocks.selectReferences.mockReturnValue([]);
  mocks.generateGeminiMockup.mockResolvedValue("mockup.png");
  mocks.generateRationale.mockReturnValue("rationale");
  mocks.generateComplianceText.mockReturnValue("compliance");
});

describe("per-sign generation context", () => {
  it("loads only assets explicitly linked to each sign", async () => {
    const assets = new Map([
      [
        "photo-1",
        { id: "photo-1", opportunityId: "opp-1", type: "CANVAS", filename: "photo-1.png" },
      ],
      [
        "logo-1",
        { id: "logo-1", opportunityId: "opp-1", type: "LOGO", filename: "logo-1.png" },
      ],
      [
        "photo-2",
        { id: "photo-2", opportunityId: "opp-1", type: "CANVAS", filename: "photo-2.png" },
      ],
    ]);
    mocks.storage.getAsset.mockImplementation(async (id: string) => assets.get(id));

    const first = await buildGenerationContext(
      makeSpec("spec-1", { canvasAssetId: "photo-1", logoAssetId: "logo-1" }),
      opportunity,
      { useAI: true }
    );
    const second = await buildGenerationContext(
      makeSpec("spec-2", { canvasAssetId: "photo-2" }),
      opportunity,
      { useAI: true }
    );

    expect(first.canvasAsset?.filename).toBe("photo-1.png");
    expect(first.logoAsset?.filename).toBe("logo-1.png");
    expect(second.canvasAsset?.filename).toBe("photo-2.png");
    expect(second.logoAsset).toBeNull();
  });

  it("passes only the selected sign instructions and no sibling logo fallback", async () => {
    const spec = makeSpec("spec-2", { promptBox: "SECOND SIGN ONLY" });
    const ctx: GenerationContext = {
      spec,
      opp: opportunity,
      canvasAsset: null,
      logoAsset: null,
      planeRaw: undefined,
      plane: undefined,
      rule: undefined,
      signTypeData: { name: spec.signType, label: "Channel Letters" } as any,
      signRefs: [],
      estimatedDimensionsInches: null,
      useAI: true,
    };

    await generateOutputMockup(ctx, {
      tier: "GOOD",
      products: [],
      tierSignType: null,
    });

    expect(mocks.generateGeminiMockup).toHaveBeenCalledWith(
      expect.objectContaining({
        promptBox: "SECOND SIGN ONLY",
        logoFilename: undefined,
        canvasFilename: undefined,
      })
    );
    expect(JSON.stringify(mocks.generateGeminiMockup.mock.calls[0][0])).not.toContain(
      "FIRST SIGN LEGACY INSTRUCTIONS"
    );
  });

  it("rejects asset ids that belong to another opportunity", async () => {
    mocks.storage.getAsset.mockImplementation(async (id: string) => ({
      id,
      opportunityId: "opp-2",
      type: id.startsWith("photo") ? "CANVAS" : "LOGO",
      filename: `${id}.png`,
    }));

    const ctx = await buildGenerationContext(
      makeSpec("spec-1", { canvasAssetId: "photo-foreign", logoAssetId: "logo-foreign" }),
      opportunity,
      { useAI: true }
    );

    expect(ctx.canvasAsset).toBeNull();
    expect(ctx.logoAsset).toBeNull();
  });
});
