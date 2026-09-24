// Thin façade — the implementation lives in ./mockup/. Route imports continue to
// resolve through this file unchanged. See docs/gemini-mockup-integration.md for the
// new module layout.
export { generateGeminiMockup } from "./mockup";
export type { MockupReference } from "./mockup/types";
