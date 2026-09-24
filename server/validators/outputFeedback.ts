import { FREE_TEXT_REQUIRED_KEY, MOCKUP_ISSUE_KEYS } from "@shared/mockupIssueOptions";
import { z } from "zod";

export const outputFeedbackBodySchema = z
  .object({
    issues: z.array(z.enum(MOCKUP_ISSUE_KEYS)).default([]),
    notes: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => (v ? v : undefined)),
    regenerate: z.boolean().default(false),
  })
  .refine((b) => b.issues.length > 0 || !!b.notes, {
    message: "Select at least one issue or describe the problem",
  })
  .refine((b) => !b.issues.includes(FREE_TEXT_REQUIRED_KEY) || !!b.notes, {
    message: "Please describe the problem when selecting 'Something else'",
  });

export type OutputFeedbackBody = z.infer<typeof outputFeedbackBodySchema>;
