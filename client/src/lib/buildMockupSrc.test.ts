import { describe, expect, it } from "vitest";
import { buildMockupSrc } from "./buildMockupSrc";

const OPP = "opp-123";
const FILE = "mockup.png";

describe("buildMockupSrc", () => {
  it("normalizes outputs/<oppId>/<file>", () => {
    expect(buildMockupSrc(`outputs/${OPP}/${FILE}`, OPP)).toBe(`/api/files/${OPP}/${FILE}`);
  });

  it("normalizes Windows-style backslash paths", () => {
    expect(buildMockupSrc(`outputs\\${OPP}\\${FILE}`, OPP)).toBe(`/api/files/${OPP}/${FILE}`);
  });

  it("normalizes ./outputs/<oppId>/<file>", () => {
    expect(buildMockupSrc(`./outputs/${OPP}/${FILE}`, OPP)).toBe(`/api/files/${OPP}/${FILE}`);
  });

  it("prefixes a bare <file> with the provided opportunityId", () => {
    expect(buildMockupSrc(FILE, OPP)).toBe(`/api/files/${OPP}/${FILE}`);
  });

  it("passes through an already-normalized <oppId>/<file>", () => {
    expect(buildMockupSrc(`${OPP}/${FILE}`, OPP)).toBe(`/api/files/${OPP}/${FILE}`);
  });

  it("returns null for null input", () => {
    expect(buildMockupSrc(null, OPP)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(buildMockupSrc(undefined, OPP)).toBeNull();
  });
});
