import { describe, expect, it } from "vitest";
import { selectReferences } from "./referenceUtils";

describe("selectReferences", () => {
  it("returns only starred refs when any exist (non-starred excluded)", () => {
    const refs = [
      { filename: "a.png", isPrimary: true, label: "starred" },
      { filename: "b.png", isPrimary: false, label: "unstarred" },
      { filename: "c.png", isPrimary: false, label: "unstarred2" },
    ];
    const result = selectReferences(refs, []);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("a.png");
    expect(result[0].isPrimary).toBe(true);
  });

  it("returns all refs when no starred refs exist", () => {
    const refs = [
      { filename: "a.png", isPrimary: false },
      { filename: "b.png", isPrimary: false },
    ];
    const result = selectReferences(refs, []);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.isPrimary === false)).toBe(true);
  });

  it("returns all refs when isPrimary is null/undefined on all", () => {
    const refs = [{ filename: "a.png", isPrimary: null }, { filename: "b.png" }];
    const result = selectReferences(refs, []);
    expect(result).toHaveLength(2);
  });

  it("appends approved examples after source refs regardless of starring", () => {
    const refs = [{ filename: "a.png", isPrimary: true }];
    const result = selectReferences(refs, ["approved1.png", "approved2.png"]);
    expect(result).toHaveLength(3);
    expect(result[0].filename).toBe("a.png");
    expect(result[1]).toEqual({ filename: "approved1.png", label: "approved example" });
    expect(result[2]).toEqual({ filename: "approved2.png", label: "approved example" });
  });

  it("appends approved examples when no starred refs and falls back to all", () => {
    const refs = [{ filename: "a.png", isPrimary: false }];
    const result = selectReferences(refs, ["approved.png"]);
    expect(result).toHaveLength(2);
    expect(result[1].filename).toBe("approved.png");
  });

  it("caps output at 6 even when many refs exist", () => {
    const refs = Array.from({ length: 5 }, (_, i) => ({
      filename: `ref${i}.png`,
      isPrimary: true,
    }));
    const result = selectReferences(refs, ["approved1.png", "approved2.png"]);
    expect(result).toHaveLength(6);
  });

  it("returns empty array for empty inputs", () => {
    expect(selectReferences([], [])).toEqual([]);
  });

  it("preserves labels from starred refs", () => {
    const refs = [{ filename: "a.png", isPrimary: true, label: "Front Lit" }];
    const result = selectReferences(refs, []);
    expect(result[0].label).toBe("Front Lit");
  });
});
