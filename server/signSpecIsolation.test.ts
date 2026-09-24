import { describe, expect, it } from "vitest";
import type { SignSpec } from "@shared/schema";
import {
  findForbiddenSignSpecPatchField,
  hasGenerationContextChanged,
  planSignSpecReconciliation,
  selectSignSpecCanvasAsset,
} from "./signSpecIsolation";

function makeSpec(id: string, overrides: Partial<SignSpec> = {}): SignSpec {
  return {
    id,
    opportunityId: "opp-1",
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
  };
}

describe("sign spec isolation", () => {
  it("retains the second sign by id when the first sign is removed", () => {
    const first = makeSpec("spec-1", {
      canvasAssetId: "photo-1",
      logoAssetId: "logo-1",
    });
    const second = makeSpec("spec-2", {
      canvasAssetId: "photo-2",
      logoAssetId: "logo-2",
      sortOrder: 1,
    });

    const plan = planSignSpecReconciliation([first, second], [
      { id: "spec-2", signType: second.signType },
    ]);

    expect(plan.existingUpdates.map(({ existing }) => existing.id)).toEqual(["spec-2"]);
    expect(plan.deletedSpecs.map((spec) => spec.id)).toEqual(["spec-1"]);
    expect(plan.newSpecs).toEqual([]);
    expect(plan.existingUpdates[0].existing.canvasAssetId).toBe("photo-2");
    expect(plan.existingUpdates[0].existing.logoAssetId).toBe("logo-2");
  });

  it("rejects duplicate and foreign ids", () => {
    const existing = [makeSpec("spec-1")];

    expect(() =>
      planSignSpecReconciliation(existing, [{ id: "spec-1" }, { id: "spec-1" }])
    ).toThrow("Duplicate sign spec id");
    expect(() => planSignSpecReconciliation(existing, [{ id: "other-spec" }])).toThrow(
      "Sign spec does not belong to this opportunity"
    );
  });

  it("invalidates outputs only for generation context changes", () => {
    const spec = makeSpec("spec-1", { promptBox: "Use red letters", sortOrder: 0 });

    expect(hasGenerationContextChanged(spec, { promptBox: "Use blue letters" })).toBe(true);
    expect(hasGenerationContextChanged(spec, { sortOrder: 1 })).toBe(false);
  });

  it("blocks asset and ownership fields from generic patches", () => {
    expect(findForbiddenSignSpecPatchField({ logoAssetId: "logo-2" })).toBe("logoAssetId");
    expect(findForbiddenSignSpecPatchField({ opportunityId: "opp-2" })).toBe("opportunityId");
    expect(findForbiddenSignSpecPatchField({ promptBox: "Own context" })).toBeUndefined();
  });

  it("selects only the sign's own site photo for PDF rendering", () => {
    const first = makeSpec("spec-1", { canvasAssetId: "photo-1" });
    const second = makeSpec("spec-2", { canvasAssetId: null });
    const assets = [
      {
        id: "photo-1",
        opportunityId: "opp-1",
        type: "CANVAS",
        filename: "photo-1.png",
        mimeType: "image/png",
        width: null,
        height: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: "photo-2",
        opportunityId: "opp-1",
        type: "CANVAS",
        filename: "photo-2.png",
        mimeType: "image/png",
        width: null,
        height: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ] as any;

    expect(selectSignSpecCanvasAsset(first, assets)?.id).toBe("photo-1");
    expect(selectSignSpecCanvasAsset(second, assets)).toBeUndefined();
    expect(
      selectSignSpecCanvasAsset(
        makeSpec("spec-3", { signType: "CORO_YARD_SIGNS", canvasAssetId: "photo-2" }),
        assets
      )
    ).toBeUndefined();
  });
});
