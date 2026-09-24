import { describe, expect, it } from "vitest";
import {
  FREE_TEXT_REQUIRED_KEY,
  MOCKUP_ISSUE_GROUPS,
  MOCKUP_ISSUE_OPTIONS,
  mockupIssueByKey,
} from "./mockupIssueOptions";

describe("MOCKUP_ISSUE_OPTIONS", () => {
  it("has unique keys", () => {
    const keys = MOCKUP_ISSUE_OPTIONS.map((o) => o.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every option belongs to a defined group", () => {
    const groupIds = new Set(MOCKUP_ISSUE_GROUPS.map((g) => g.id));
    for (const option of MOCKUP_ISSUE_OPTIONS) {
      expect(groupIds.has(option.group)).toBe(true);
    }
  });

  it("every option except the free-text one has a prompt hint", () => {
    for (const option of MOCKUP_ISSUE_OPTIONS) {
      if (option.key === FREE_TEXT_REQUIRED_KEY) {
        expect(option.promptHint).toBe("");
      } else {
        expect(option.promptHint.length).toBeGreaterThan(0);
      }
    }
  });

  it("mockupIssueByKey resolves every option", () => {
    for (const option of MOCKUP_ISSUE_OPTIONS) {
      expect(mockupIssueByKey.get(option.key)).toBe(option);
    }
  });
});
