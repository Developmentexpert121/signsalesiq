DO $$ BEGIN CREATE TYPE "public"."asset_type" AS ENUM('CANVAS', 'LOGO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."budget_range" AS ENUM('0_500', '500_1K', '1K_2K', '2K_5K', '5K_10K', '10K_PLUS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."location_type" AS ENUM('INTERIOR', 'EXTERIOR', 'VEHICLE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."opportunity_status" AS ENUM('OPEN', 'WON', 'LOST', 'FOLLOW_UP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."role" AS ENUM('SUPER_ADMIN', 'ADMIN', 'SALES', 'ACCOUNT_MANAGER', 'PROJECT_MANAGER', 'OUTSIDE_SALES', 'INSIDE_SALES', 'SALES_MANAGER', 'DESIGNER', 'PRODUCTION_MANAGER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."sign_duration" AS ENUM('PERMANENT', 'TEMPORARY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."target_audience" AS ENUM('SELL', 'DIRECT', 'INFORMATION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."tier" AS ENUM('GOOD', 'BETTER', 'BEST'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar,
        "user_name" text,
        "tenant_id" varchar,
        "tenant_name" text,
        "action" text NOT NULL,
        "provider" text NOT NULL,
        "model" text,
        "prompt_tokens" integer,
        "completion_tokens" integer,
        "total_tokens" integer,
        "status" text DEFAULT 'success' NOT NULL,
        "error_message" text,
        "metadata" json,
        "duration_ms" integer,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "opportunity_id" varchar NOT NULL,
        "type" "asset_type" NOT NULL,
        "filename" text NOT NULL,
        "mime_type" text NOT NULL,
        "width" integer,
        "height" integer,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "template_key" text NOT NULL,
        "recipient_email" text NOT NULL,
        "recipient_name" text,
        "subject" text NOT NULL,
        "status" text DEFAULT 'sent' NOT NULL,
        "error_message" text,
        "metadata" json,
        "sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_templates" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "template_key" text NOT NULL,
        "name" text NOT NULL,
        "subject" text NOT NULL,
        "body_html" text NOT NULL,
        "description" text,
        "variables" json DEFAULT '[]'::json,
        "active" boolean DEFAULT true,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "email_templates_template_key_unique" UNIQUE("template_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exports" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "opportunity_id" varchar NOT NULL,
        "pdf_filename" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "opportunities" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_id" varchar NOT NULL,
        "tenant_id" varchar,
        "client_name" text NOT NULL,
        "contact_name" text,
        "address" text NOT NULL,
        "phone" text,
        "email" text,
        "prompt_box" text,
        "sign_duration" "sign_duration" NOT NULL,
        "location_type" "location_type" NOT NULL,
        "target_audience" "target_audience" NOT NULL,
        "read_distance_ft" integer,
        "has_logo" boolean DEFAULT false,
        "budget_range" "budget_range" NOT NULL,
        "sign_type" text NOT NULL,
        "sign_code_text" text,
        "notes" text,
        "status" "opportunity_status" DEFAULT 'OPEN' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outputs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "opportunity_id" varchar NOT NULL,
        "sign_spec_id" varchar,
        "tier" "tier" NOT NULL,
        "baseline_image_filename" text,
        "firefly_image_filename" text,
        "selected_products" json NOT NULL,
        "rationale_text" text,
        "compliance_text" text,
        "accuracy_score_baseline" integer,
        "accuracy_score_firefly" integer,
        "accuracy_notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "owner_subscriptions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" varchar,
        "user_id" varchar,
        "plan_id" varchar,
        "events_used" integer DEFAULT 0,
        "status" text DEFAULT 'inactive' NOT NULL,
        "stripe_session_id" text,
        "stripe_subscription_id" text,
        "subscribed_at" timestamp,
        "expiration_notified" text,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "token" text NOT NULL,
        "expires_at" timestamp NOT NULL,
        "used" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "planes" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "opportunity_id" varchar NOT NULL,
        "sign_spec_id" varchar,
        "points" json NOT NULL,
        "reference_line" json,
        "reference_length_inches" integer,
        "straighten_to_rect" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_rules" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" varchar,
        "location_type" "location_type" NOT NULL,
        "sign_type" text NOT NULL,
        "budget_range" "budget_range" NOT NULL,
        "enabled_tiers" json DEFAULT '["GOOD","BETTER","BEST"]'::json NOT NULL,
        "good_sign_type" text,
        "better_sign_type" text,
        "best_sign_type" text,
        "good_products" json NOT NULL,
        "better_products" json NOT NULL,
        "best_products" json NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sign_specs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "opportunity_id" varchar NOT NULL,
        "canvas_asset_id" varchar,
        "logo_asset_id" varchar,
        "sign_type" text NOT NULL,
        "location_type" "location_type" NOT NULL,
        "budget_range" "budget_range" NOT NULL,
        "sign_duration" "sign_duration" NOT NULL,
        "target_audience" "target_audience" DEFAULT 'SELL' NOT NULL,
        "read_distance_ft" integer,
        "show_sign_code" boolean DEFAULT false,
        "sign_code_text" text,
        "prompt_box" text,
        "sort_order" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sign_type_references" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "sign_type" text NOT NULL,
        "filename" text NOT NULL,
        "mime_type" text NOT NULL,
        "label" text,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sign_types" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "label" text NOT NULL,
        "category" text DEFAULT 'INTERIOR' NOT NULL,
        "description" text,
        "sample_prompt" text,
        "attributes" json DEFAULT '[]'::json,
        "sort_order" integer DEFAULT 0,
        "active" boolean DEFAULT true,
        "show_sign_code" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "sign_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_plans" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "price" text NOT NULL,
        "original_price" text,
        "event_limit" integer DEFAULT 100 NOT NULL,
        "sort_order" integer DEFAULT 0,
        "active" boolean DEFAULT true,
        "is_default" boolean DEFAULT false,
        "features" json DEFAULT '[]'::json,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_settings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "subscription_gate_enabled" boolean DEFAULT false,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "phone" text,
        "email" text,
        "address" text,
        "website" text,
        "logo_filename" text,
        "pdf_template_filename" text,
        "pdf_header_text" text,
        "pdf_footer_text" text,
        "pdf_banner_text" text,
        "pdf_primary_color" text,
        "pdf_accent_color" text,
        "onboarding_complete" boolean DEFAULT false,
        "active" boolean DEFAULT true,
        "stripe_customer_id" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "email" text NOT NULL,
        "phone" text,
        "password_hash" text NOT NULL,
        "role" "role" DEFAULT 'SALES' NOT NULL,
        "tenant_id" varchar,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "last_login_at" timestamp,
        CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
        "id" serial PRIMARY KEY NOT NULL,
        "title" text NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
        "id" serial PRIMARY KEY NOT NULL,
        "conversation_id" integer NOT NULL,
        "role" text NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "replit_auth_users" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "email" varchar,
        "first_name" varchar,
        "last_name" varchar,
        "profile_image_url" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "replit_auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
        "sid" varchar PRIMARY KEY NOT NULL,
        "sess" jsonb NOT NULL,
        "expire" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets" ADD CONSTRAINT "assets_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "exports" ADD CONSTRAINT "exports_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "outputs" ADD CONSTRAINT "outputs_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "outputs" ADD CONSTRAINT "outputs_sign_spec_id_sign_specs_id_fk" FOREIGN KEY ("sign_spec_id") REFERENCES "public"."sign_specs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "owner_subscriptions" ADD CONSTRAINT "owner_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "owner_subscriptions" ADD CONSTRAINT "owner_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "owner_subscriptions" ADD CONSTRAINT "owner_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "planes" ADD CONSTRAINT "planes_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "planes" ADD CONSTRAINT "planes_sign_spec_id_sign_specs_id_fk" FOREIGN KEY ("sign_spec_id") REFERENCES "public"."sign_specs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "product_rules" ADD CONSTRAINT "product_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sign_specs" ADD CONSTRAINT "sign_specs_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sign_specs" ADD CONSTRAINT "sign_specs_canvas_asset_id_assets_id_fk" FOREIGN KEY ("canvas_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sign_specs" ADD CONSTRAINT "sign_specs_logo_asset_id_assets_id_fk" FOREIGN KEY ("logo_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" USING btree ("expire");
