import type { MockupReference } from "./types";

// Build a primary-first reference list for the mockup service.
// Strict starred-only: when any isPrimary=true refs exist, ONLY those are
// sent to Gemini. Non-starred refs fill slots only when zero starred exist.
// This ensures all 4 Gemini image slots go to admin-curated "Best Selection"
// images rather than being diluted by unvetted references.
// Approved feedback examples are appended in both cases. Total capped at 6
// (the service slices to MAX_REFERENCE_IMAGES=4 for the actual LLM call).
export function selectReferences(
  baseRefs: { filename: string; label?: string | null; isPrimary?: boolean | null }[],
  approvedFilenames: string[]
): MockupReference[] {
  const primaries = baseRefs.filter((r) => r.isPrimary);
  const sourceRefs = primaries.length > 0 ? primaries : baseRefs;
  const ordered: MockupReference[] = [
    ...sourceRefs.map((r) => ({
      filename: r.filename,
      label: r.label ?? undefined,
      isPrimary: !!r.isPrimary,
    })),
    ...approvedFilenames.map((filename) => ({ filename, label: "approved example" })),
  ];
  return ordered.slice(0, 6);
}
