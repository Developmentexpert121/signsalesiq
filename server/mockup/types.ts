import { tierEnum } from "@shared/schema";

// Derived from the authoritative Drizzle schema enum — not duplicated manually.
export type Tier = (typeof tierEnum.enumValues)[number];

// The @google/genai SDK does not export model name constants (model is `string`
// in GenerateContentParameters). This union is our domain narrowing to catch
// typos at compile time — keep updating when new models are onboarded.
export type GeminiModel =
  | "gemini-3-pro-image-preview"
  | "gemini-3.1-flash-image-preview"
  | "gemini-2.5-flash-image";

// No library equivalent; identifies which AI backend produced a given mockup.
export type MockupProvider = "vertex-ai" | "gemini-proxy";

export type MockupReference = {
  filename: string;
  label?: string;
  isPrimary?: boolean;
};

// One curated golden few-shot pair: a description of the ideal input spec for
// this sign type paired with the accepted output image (filename in object
// storage). Injected before the [SIGN REFERENCES] block as calibration.
export type FewShotExample = {
  inputText: string;
  outputFilename: string;
  label?: string;
};
