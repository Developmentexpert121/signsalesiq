import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { sharedSchema } from "../shared/env.shared";

export const env = createEnv({
  server: {},
  shared: sharedSchema,
  clientPrefix: "VITE_",
  client: {
    VITE_PUBLIC_APP_URL: z.string().url().optional(),
    VITE_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),
    VITE_ENABLE_GBB_TIERS: z.enum(["true", "false"]).optional(),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
