CREATE TABLE "sign_type_examples" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sign_type" text NOT NULL,
	"example_input" text NOT NULL,
	"example_output_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"label" text,
	"sort_order" integer DEFAULT 0,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sign_type_examples_sign_type_idx" ON "sign_type_examples" USING btree ("sign_type");
