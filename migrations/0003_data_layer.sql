-- Phase 4: data layer correctness
-- Performance indexes, schema mutations previously in seed.ts, and new tables

--> statement-breakpoint

-- 0. New tables

CREATE TABLE IF NOT EXISTS "processed_stripe_events" (
  "event_id" text PRIMARY KEY NOT NULL,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- 1. Schema mutations migrated out of seed.ts runMigrations()

ALTER TYPE location_type ADD VALUE IF NOT EXISTS 'VEHICLE';

--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signsuiteiq_user_id" integer;

--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "users_signsuiteiq_user_id_unique" ON "users" ("signsuiteiq_user_id") WHERE signsuiteiq_user_id IS NOT NULL;

--> statement-breakpoint

UPDATE "sign_types" SET "category" = 'VEHICLE'
  WHERE "name" IN ('VEHICLE_LETTERING', 'VEHICLE_WRAP_FULL', 'VEHICLE_WRAP_PARTIAL')
    AND "category" != 'VEHICLE';

--> statement-breakpoint

UPDATE "product_rules" SET "location_type" = 'VEHICLE'
  WHERE "sign_type" IN ('VEHICLE_LETTERING', 'VEHICLE_WRAP_FULL', 'VEHICLE_WRAP_PARTIAL')
    AND "location_type" != 'VEHICLE';

--> statement-breakpoint

-- 2. Performance indexes for tenant-scoped queries

CREATE INDEX IF NOT EXISTS "opp_tenant_id_idx" ON "opportunities" ("tenant_id");
CREATE INDEX IF NOT EXISTS "opp_tenant_created_idx" ON "opportunities" ("tenant_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "opp_owner_id_idx" ON "opportunities" ("owner_id");
CREATE INDEX IF NOT EXISTS "opp_status_idx" ON "opportunities" ("tenant_id", "status");

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "assets_opportunity_id_idx" ON "assets" ("opportunity_id");
CREATE INDEX IF NOT EXISTS "sign_specs_opportunity_id_idx" ON "sign_specs" ("opportunity_id");
CREATE INDEX IF NOT EXISTS "outputs_opportunity_id_idx" ON "outputs" ("opportunity_id");
CREATE INDEX IF NOT EXISTS "outputs_sign_spec_id_idx" ON "outputs" ("sign_spec_id");
CREATE INDEX IF NOT EXISTS "exports_opportunity_id_idx" ON "exports" ("opportunity_id");
CREATE INDEX IF NOT EXISTS "planes_opportunity_id_idx" ON "planes" ("opportunity_id");

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "activity_logs_tenant_created_idx" ON "activity_logs" ("tenant_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "activity_logs_user_id_idx" ON "activity_logs" ("user_id");
