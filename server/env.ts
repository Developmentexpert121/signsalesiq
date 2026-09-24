import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { sharedSchema } from "../shared/env.shared";

export const env = createEnv({
  server: {
    // ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: z.string().url(),
    DO_DATABASE_URL: z.string().url().optional(),

    // ── DO Spaces (object storage) ────────────────────────────────────────────
    DO_SPACES_KEY: z.string().optional(),
    DO_SPACES_SECRET: z.string().optional(),
    DO_SPACES_ENDPOINT: z.string().optional(),
    DO_SPACES_BUCKET: z.string().optional(),
    DO_SPACES_REGION: z.string().default("nyc3"),

    // ── Sessions (required) ───────────────────────────────────────────────────
    SESSION_SECRET: z.string().min(32),

    // ── Stripe ────────────────────────────────────────────────────────────────
    STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),

    // ── Email ─────────────────────────────────────────────────────────────────
    RESEND_API_KEY: z.string().optional(),
    EMAIL_PROVIDER: z.string().default("auto"),
    SMTP_HOST: z.string().default("smtp0001.neo.space"),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),

    // ── AI services ───────────────────────────────────────────────────────────
    VERTEX_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
    AI_INTEGRATIONS_GEMINI_API_KEY: z.string().optional(),
    AI_INTEGRATIONS_GEMINI_BASE_URL: z.string().url().optional(),
    AI_INTEGRATIONS_OPENAI_API_KEY: z.string().optional(),
    AI_INTEGRATIONS_OPENAI_BASE_URL: z.string().url().optional(),
    FIREFLY_CLIENT_ID: z.string().optional(),
    FIREFLY_CLIENT_SECRET: z.string().optional(),

    // ── Object storage (Replit) ───────────────────────────────────────────────
    DEFAULT_OBJECT_STORAGE_BUCKET_ID: z.string().optional(),

    // ── Replit ────────────────────────────────────────────────────────────────
    REPL_ID: z.string().optional(),
    REPLIT_DOMAINS: z.string().optional(),
    ISSUER_URL: z.string().url().optional(),
    PUBLIC_OBJECT_SEARCH_PATHS: z.string().optional(),
    PRIVATE_OBJECT_DIR: z.string().optional(),

    // ── Observability ─────────────────────────────────────────────────────────
    SENTRY_DSN: z.string().url().optional(),

    // ── App ───────────────────────────────────────────────────────────────────
    PORT: z.coerce.number().int().positive().default(5000),
    APP_BASE_URL: z.string().url().optional(),
    PUBLIC_APP_URL: z.string().url().optional(),
    SIGNSUITEIQ_SSO_SECRET: z.string().optional(),
    SSO_SECRET_SIGNSALESIQ: z.string().optional(),
    GIT_SHA: z.string().optional(),

    // ── Seed / dev ────────────────────────────────────────────────────────────
    SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
    SEED_USER_PASSWORD: z.string().min(8).optional(),
    FORCE_SEED: z.string().optional(),
  },
  shared: sharedSchema,
  clientPrefix: "VITE_",
  client: {},
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
