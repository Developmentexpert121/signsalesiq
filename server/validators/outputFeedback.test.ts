import { describe, expect, it } from "vitest";
import { outputFeedbackBodySchema } from "./outputFeedback";

describe("outputFeedbackBodySchema", () => {
  it("accepts issues without notes", () => {
    const parsed = outputFeedbackBodySchema.parse({ issues: ["LOGO_BLURRY"] });
    expect(parsed.issues).toEqual(["LOGO_BLURRY"]);
    expect(parsed.regenerate).toBe(false);
  });

  it("accepts notes without issues", () => {
    const parsed = outputFeedbackBodySchema.parse({ notes: "The sign looks wrong" });
    expect(parsed.issues).toEqual([]);
    expect(parsed.notes).toBe("The sign looks wrong");
  });

  it("rejects empty submissions", () => {
    expect(() => outputFeedbackBodySchema.parse({})).toThrow();
    expect(() => outputFeedbackBodySchema.parse({ issues: [], notes: "   " })).toThrow();
  });

  it("rejects unknown issue keys", () => {
    expect(() => outputFeedbackBodySchema.parse({ issues: ["NOT_A_KEY"] })).toThrow();
  });

  it("requires notes when 'Something else' is selected", () => {
    expect(() => outputFeedbackBodySchema.parse({ issues: ["SOMETHING_ELSE"] })).toThrow();
    const parsed = outputFeedbackBodySchema.parse({
      issues: ["SOMETHING_ELSE"],
      notes: "Custom problem",
    });
    expect(parsed.notes).toBe("Custom problem");
  });
});
