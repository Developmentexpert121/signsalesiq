import { z } from "zod";

export const sharedSchema = {
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
};
