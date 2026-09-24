CREATE TABLE "mockup_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model" text DEFAULT 'gemini-3-pro-image-preview' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
