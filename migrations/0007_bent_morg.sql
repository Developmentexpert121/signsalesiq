CREATE TABLE "output_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"output_id" varchar,
	"opportunity_id" varchar NOT NULL,
	"sign_spec_id" varchar,
	"user_id" varchar,
	"tenant_id" varchar,
	"tier" "tier" NOT NULL,
	"sign_type" text NOT NULL,
	"issue_keys" text[] NOT NULL,
	"free_text" text,
	"flagged_mockup_filename" text,
	"regeneration_requested" boolean DEFAULT false NOT NULL,
	"regeneration_succeeded" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "output_feedback" ADD CONSTRAINT "output_feedback_output_id_outputs_id_fk" FOREIGN KEY ("output_id") REFERENCES "public"."outputs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "output_feedback" ADD CONSTRAINT "output_feedback_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "output_feedback" ADD CONSTRAINT "output_feedback_sign_spec_id_sign_specs_id_fk" FOREIGN KEY ("sign_spec_id") REFERENCES "public"."sign_specs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "output_feedback" ADD CONSTRAINT "output_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "output_feedback" ADD CONSTRAINT "output_feedback_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "output_feedback_opportunity_id_idx" ON "output_feedback" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "output_feedback_output_id_idx" ON "output_feedback" USING btree ("output_id");--> statement-breakpoint
CREATE INDEX "output_feedback_created_at_idx" ON "output_feedback" USING btree ("created_at");