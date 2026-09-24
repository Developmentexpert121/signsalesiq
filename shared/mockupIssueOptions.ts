// Predefined issue options users can flag on a generated mockup. Shared between
// client (renders group headings + labels) and server (maps selected keys to
// prompt-correction hints injected into the regeneration prompt as instance-scoped
// improvement guidance). Keys are persisted in output_feedback.issue_keys.

export const MOCKUP_ISSUE_GROUPS = [
  { id: "LOGO_BRANDING", label: "Logo & branding" },
  { id: "BACKGROUND_LAYOUT", label: "Background & layout" },
  { id: "SIGN_CONTENT", label: "Sign content" },
  { id: "OTHER", label: "Other" },
] as const;

export type MockupIssueGroupId = (typeof MOCKUP_ISSUE_GROUPS)[number]["id"];

export interface MockupIssueOption {
  key: string;
  label: string;
  group: MockupIssueGroupId;
  // Correction sentence injected into the regen prompt. Hints must respect the
  // source-of-truth hierarchy: original site photo untouched, references =
  // construction truth, logo/company name = branding truth.
  promptHint: string;
}

export const FREE_TEXT_REQUIRED_KEY = "SOMETHING_ELSE";

export const MOCKUP_ISSUE_OPTIONS: MockupIssueOption[] = [
  {
    key: "LOGO_BLURRY",
    label: "Logo is blurry or low resolution",
    group: "LOGO_BRANDING",
    promptHint:
      "Render the client logo crisp and sharp at full resolution — no blur, pixelation, or compression artifacts.",
  },
  {
    key: "LOGO_COLORS_INACCURATE",
    label: "Logo colors are inaccurate",
    group: "LOGO_BRANDING",
    promptHint:
      "Reproduce the client logo's exact original colors — do not shift hue, saturation, or brightness.",
  },
  {
    key: "LOGO_SKEWED",
    label: "Logo is skewed or distorted",
    group: "LOGO_BRANDING",
    promptHint:
      "Preserve the client logo's exact proportions and geometry — no skewing, stretching, or warping beyond the sign plane's natural perspective.",
  },
  {
    key: "WRONG_LOGO",
    label: "Wrong logo used",
    group: "LOGO_BRANDING",
    promptHint:
      "Use ONLY the attached client logo artwork exactly as provided — never substitute, redraw, or invent a different logo.",
  },
  {
    key: "FONT_MISMATCH",
    label: "Font doesn't match brand",
    group: "LOGO_BRANDING",
    promptHint:
      "Match all lettering to the client's brand typography as shown in the attached logo — do not substitute an unrelated typeface.",
  },
  {
    key: "BACKGROUND_INCORRECT",
    label: "Background is incorrect",
    group: "BACKGROUND_LAYOUT",
    promptHint:
      "Keep the original site photo background EXACTLY as provided — change nothing outside the sign area and never invent a new scene or alter the building.",
  },
  {
    key: "LAYOUT_OFF",
    label: "Layout / composition looks off",
    group: "BACKGROUND_LAYOUT",
    promptHint:
      "Improve the composition: balanced, professional placement of the logo and text within the sign area.",
  },
  {
    key: "SIZING_WRONG",
    label: "Sizing doesn't look right",
    group: "BACKGROUND_LAYOUT",
    promptHint:
      "Correct the sign's scale so it is proportionally believable against doors, windows, and surroundings and matches the specified real-world dimensions.",
  },
  {
    key: "WRONG_MOUNTING_LOCATION",
    label: "Wrong mounting location shown",
    group: "BACKGROUND_LAYOUT",
    promptHint:
      "Place the sign only in the designated mounting area marked on the site photo — do not relocate it.",
  },
  {
    key: "WRONG_SIGN_TYPE",
    label: "Sign type is wrong (e.g. ADA shown as directory)",
    group: "SIGN_CONTENT",
    promptHint:
      "Render the correct sign type as specified, matching the construction shown in the reference photos exactly — do not substitute a different sign category.",
  },
  {
    key: "MISSING_SIGNS",
    label: "Missing signs or incomplete output",
    group: "SIGN_CONTENT",
    promptHint:
      "Render the complete sign as specified — nothing missing, cropped, or partially rendered.",
  },
  {
    key: "TEXT_ERRORS",
    label: "Text or copy errors on mockup",
    group: "SIGN_CONTENT",
    promptHint:
      "Spell all text exactly as provided — the company name and copy must be letter-perfect with no invented or garbled characters.",
  },
  {
    key: "WRONG_STYLE",
    label: "Wrong sign style for this application",
    group: "SIGN_CONTENT",
    promptHint:
      "Use a sign style appropriate for this application and location, matching the reference photos' construction and finish.",
  },
  {
    key: "OVERALL_QUALITY",
    label: "Overall quality is poor — please review",
    group: "OTHER",
    promptHint:
      "Substantially improve overall realism and production quality: photorealistic materials, lighting, and seamless integration with the site photo.",
  },
  {
    key: FREE_TEXT_REQUIRED_KEY,
    label: "Something else (describe below)",
    group: "OTHER",
    promptHint: "",
  },
];

export const MOCKUP_ISSUE_KEYS = MOCKUP_ISSUE_OPTIONS.map((o) => o.key) as [string, ...string[]];

export const mockupIssueByKey: ReadonlyMap<string, MockupIssueOption> = new Map(
  MOCKUP_ISSUE_OPTIONS.map((o) => [o.key, o])
);
