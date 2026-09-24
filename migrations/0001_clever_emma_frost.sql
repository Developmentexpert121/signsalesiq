CREATE TABLE IF NOT EXISTS "mockup_feedback" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "sign_type" text NOT NULL,
        "tier" text DEFAULT 'GOOD' NOT NULL,
        "prompt_used" text,
        "generated_filename" text,
        "rating" text NOT NULL,
        "notes" text,
        "improvement_areas" text[],
        "sign_type_label" text,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sign_type_references" ADD COLUMN "is_primary" boolean DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sign_types" ADD COLUMN "generation_notes" text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mockup_feedback" ADD COLUMN "improvement_areas" text[];
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
