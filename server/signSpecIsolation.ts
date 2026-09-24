import { isFullSceneOnly } from "@shared/fullSceneOnlySignTypes";
import type { Asset, SignSpec } from "@shared/schema";

export const SIGN_SPEC_GENERATION_FIELDS = [
  "signType",
  "locationType",
  "budgetRange",
  "signDuration",
  "targetAudience",
  "readDistanceFt",
  "showSignCode",
  "signCodeText",
  "promptBox",
] as const;

export const FORBIDDEN_SIGN_SPEC_PATCH_FIELDS = [
  "id",
  "opportunityId",
  "canvasAssetId",
  "logoAssetId",
  "createdAt",
] as const;

export function hasGenerationContextChanged(
  existing: SignSpec,
  updates: Record<string, unknown>
): boolean {
  return SIGN_SPEC_GENERATION_FIELDS.some(
    (field) =>
      Object.prototype.hasOwnProperty.call(updates, field) && updates[field] !== existing[field]
  );
}

export function findForbiddenSignSpecPatchField(
  updates: Record<string, unknown>
): string | undefined {
  return FORBIDDEN_SIGN_SPEC_PATCH_FIELDS.find((field) =>
    Object.prototype.hasOwnProperty.call(updates, field)
  );
}

export function selectSignSpecCanvasAsset(
  spec: Pick<SignSpec, "canvasAssetId" | "signType">,
  assets: Asset[]
): Asset | undefined {
  if (!spec.canvasAssetId || isFullSceneOnly(spec.signType)) return undefined;
  return assets.find(
    (asset) => asset.id === spec.canvasAssetId && asset.type === "CANVAS"
  );
}

export function planSignSpecReconciliation<T extends { id?: unknown }>(
  existingSpecs: SignSpec[],
  submittedSpecs: T[]
): {
  existingUpdates: { existing: SignSpec; submitted: T; index: number }[];
  newSpecs: { submitted: T; index: number }[];
  deletedSpecs: SignSpec[];
} {
  const existingIds = new Set(existingSpecs.map((spec) => spec.id));
  const existingById = new Map(existingSpecs.map((spec) => [spec.id, spec]));
  const submittedIds = new Set<string>();
  const existingUpdates: { existing: SignSpec; submitted: T; index: number }[] = [];
  const newSpecs: { submitted: T; index: number }[] = [];

  for (const [index, spec] of submittedSpecs.entries()) {
    if (spec.id === undefined || spec.id === null) {
      newSpecs.push({ submitted: spec, index });
      continue;
    }
    if (typeof spec.id !== "string" || spec.id.length === 0) {
      throw new Error("Invalid sign spec id");
    }
    if (!existingIds.has(spec.id)) {
      throw new Error("Sign spec does not belong to this opportunity");
    }
    if (submittedIds.has(spec.id)) {
      throw new Error("Duplicate sign spec id");
    }
    submittedIds.add(spec.id);
    const existing = existingById.get(spec.id);
    if (!existing) {
      throw new Error("Sign spec does not belong to this opportunity");
    }
    existingUpdates.push({
      existing,
      submitted: spec,
      index,
    });
  }

  return {
    existingUpdates,
    newSpecs,
    deletedSpecs: existingSpecs.filter((spec) => !submittedIds.has(spec.id)),
  };
}
