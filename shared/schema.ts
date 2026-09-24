import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  json,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", [
  "SUPER_ADMIN",
  "ADMIN",
  "SALES",
  "ACCOUNT_MANAGER",
  "PROJECT_MANAGER",
  "OUTSIDE_SALES",
  "INSIDE_SALES",
  "SALES_MANAGER",
  "DESIGNER",
  "PRODUCTION_MANAGER",
]);
export const signDurationEnum = pgEnum("sign_duration", ["PERMANENT", "TEMPORARY"]);
export const locationTypeEnum = pgEnum("location_type", ["INTERIOR", "EXTERIOR", "VEHICLE"]);
export const targetAudienceEnum = pgEnum("target_audience", ["SELL", "DIRECT", "INFORMATION"]);
export const budgetRangeEnum = pgEnum("budget_range", [
  "0_500",
  "500_1K",
  "1K_2K",
  "2K_5K",
  "5K_10K",
  "10K_PLUS",
]);
export const assetTypeEnum = pgEnum("asset_type", ["CANVAS", "LOGO"]);
export const tierEnum = pgEnum("tier", ["GOOD", "BETTER", "BEST"]);
export const opportunityStatusEnum = pgEnum("opportunity_status", [
  "OPEN",
  "WON",
  "LOST",
  "FOLLOW_UP",
]);

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  signsuiteiqCompanyId: integer("signsuiteiq_company_id").unique(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  website: text("website"),
  logoFilename: text("logo_filename"),
  pdfTemplateFilename: text("pdf_template_filename"),
  pdfHeaderText: text("pdf_header_text"),
  pdfFooterText: text("pdf_footer_text"),
  pdfBannerText: text("pdf_banner_text"),
  pdfPrimaryColor: text("pdf_primary_color"),
  pdfAccentColor: text("pdf_accent_color"),
  onboardingComplete: boolean("onboarding_complete").default(false),
  active: boolean("active").default(true),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const signTypes = pgTable("sign_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  label: text("label").notNull(),
  category: text("category").notNull().default("INTERIOR"),
  description: text("description"),
  samplePrompt: text("sample_prompt"),
  generationNotes: text("generation_notes"),
  attributes: json("attributes").$type<string[]>().default([]),
  sortOrder: integer("sort_order").default(0),
  active: boolean("active").default(true),
  showSignCode: boolean("show_sign_code").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("SALES"),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
  signsuiteiqUserId: integer("signsuiteiq_user_id").unique(),
  username: text("username"),
  jobTitle: text("job_title"),
  location: text("location"),
  deletedAt: timestamp("deleted_at"),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export const opportunities = pgTable(
  "opportunities",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    ownerId: varchar("owner_id")
      .notNull()
      .references(() => users.id),
    tenantId: varchar("tenant_id").references(() => tenants.id),
    clientName: text("client_name").notNull(),
    contactName: text("contact_name"),
    address: text("address").notNull(),
    phone: text("phone"),
    email: text("email"),
    promptBox: text("prompt_box"),
    signDuration: signDurationEnum("sign_duration").notNull(),
    locationType: locationTypeEnum("location_type").notNull(),
    targetAudience: targetAudienceEnum("target_audience").notNull(),
    readDistanceFt: integer("read_distance_ft"),
    showSignCode: boolean("has_logo").default(false),
    budgetRange: budgetRangeEnum("budget_range").notNull(),
    signType: text("sign_type").notNull(),
    signCodeText: text("sign_code_text"),
    notes: text("notes"),
    status: opportunityStatusEnum("status").notNull().default("OPEN"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("opp_tenant_id_idx").on(t.tenantId),
    index("opp_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("opp_owner_id_idx").on(t.ownerId),
    index("opp_status_idx").on(t.tenantId, t.status),
  ]
);

export const assets = pgTable(
  "assets",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    opportunityId: varchar("opportunity_id")
      .notNull()
      .references(() => opportunities.id),
    type: assetTypeEnum("type").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("assets_opportunity_id_idx").on(t.opportunityId)]
);

export const signSpecs = pgTable(
  "sign_specs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    opportunityId: varchar("opportunity_id")
      .notNull()
      .references(() => opportunities.id),
    canvasAssetId: varchar("canvas_asset_id").references(() => assets.id),
    logoAssetId: varchar("logo_asset_id").references(() => assets.id),
    signType: text("sign_type").notNull(),
    locationType: locationTypeEnum("location_type").notNull(),
    budgetRange: budgetRangeEnum("budget_range").notNull(),
    signDuration: signDurationEnum("sign_duration").notNull(),
    targetAudience: targetAudienceEnum("target_audience").notNull().default("SELL"),
    readDistanceFt: integer("read_distance_ft"),
    showSignCode: boolean("show_sign_code").default(false),
    signCodeText: text("sign_code_text"),
    promptBox: text("prompt_box"),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("sign_specs_opportunity_id_idx").on(t.opportunityId)]
);

export const planes = pgTable(
  "planes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    opportunityId: varchar("opportunity_id")
      .notNull()
      .references(() => opportunities.id),
    signSpecId: varchar("sign_spec_id").references(() => signSpecs.id),
    points: json("points").$type<{ x: number; y: number }[]>().notNull(),
    referenceLine: json("reference_line").$type<{ x: number; y: number }[]>(),
    referenceLengthInches: integer("reference_length_inches"),
    straightenToRect: boolean("straighten_to_rect").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("planes_opportunity_id_idx").on(t.opportunityId)]
);

export const productRules = pgTable("product_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  locationType: locationTypeEnum("location_type").notNull(),
  signType: text("sign_type").notNull(),
  budgetRange: budgetRangeEnum("budget_range").notNull(),
  enabledTiers: json("enabled_tiers")
    .$type<string[]>()
    .notNull()
    .default(["GOOD", "BETTER", "BEST"]),
  goodSignType: text("good_sign_type"),
  betterSignType: text("better_sign_type"),
  bestSignType: text("best_sign_type"),
  goodProducts: json("good_products").$type<string[]>().notNull(),
  betterProducts: json("better_products").$type<string[]>().notNull(),
  bestProducts: json("best_products").$type<string[]>().notNull(),
});

export const signTypeReferences = pgTable("sign_type_references", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signType: text("sign_type").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  label: text("label"),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Curated golden few-shot pairs per sign type. Each row is one (input spec text,
// accepted output image) example used to calibrate the LLM. Distinct from
// sign_type_references — refs ground construction; examples ground the *kind of
// output* we accept. Manually curated by admins; not auto-promoted from feedback.
export const signTypeExamples = pgTable("sign_type_examples", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signType: text("sign_type").notNull(),
  exampleInput: text("example_input").notNull(),
  exampleOutputFilename: text("example_output_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  label: text("label"),
  sortOrder: integer("sort_order").default(0),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mockupFeedback = pgTable("mockup_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signType: text("sign_type").notNull(),
  tier: text("tier").notNull().default("GOOD"),
  promptUsed: text("prompt_used"),
  generatedFilename: text("generated_filename"),
  rating: text("rating").notNull(),
  notes: text("notes"),
  improvementAreas: text("improvement_areas").array(),
  signTypeLabel: text("sign_type_label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const outputs = pgTable(
  "outputs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    opportunityId: varchar("opportunity_id")
      .notNull()
      .references(() => opportunities.id),
    signSpecId: varchar("sign_spec_id").references(() => signSpecs.id),
    tier: tierEnum("tier").notNull(),
    baselineImageFilename: text("baseline_image_filename"),
    aiMockupFilename: text("firefly_image_filename"),
    selectedProducts: json("selected_products").$type<string[]>().notNull(),
    rationaleText: text("rationale_text"),
    complianceText: text("compliance_text"),
    accuracyScoreBaseline: integer("accuracy_score_baseline"),
    accuracyScoreAI: integer("accuracy_score_firefly"),
    accuracyNotes: text("accuracy_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("outputs_opportunity_id_idx").on(t.opportunityId),
    index("outputs_sign_spec_id_idx").on(t.signSpecId),
  ]
);

// Instance-scoped user feedback on one generated output. Drives ONLY the immediate
// regeneration of that output plus later admin review/analytics. Deliberately separate
// from mockup_feedback, which feeds the global per-sign-type learning system
// (getApprovedFeedbackImages / getNeedsWorkSummary) — rows here must never enter those.
export const outputFeedback = pgTable(
  "output_feedback",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    outputId: varchar("output_id").references(() => outputs.id, { onDelete: "set null" }),
    opportunityId: varchar("opportunity_id")
      .notNull()
      .references(() => opportunities.id),
    signSpecId: varchar("sign_spec_id").references(() => signSpecs.id, { onDelete: "set null" }),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    tier: tierEnum("tier").notNull(),
    signType: text("sign_type").notNull(),
    issueKeys: text("issue_keys").array().notNull(),
    freeText: text("free_text"),
    flaggedMockupFilename: text("flagged_mockup_filename"),
    regenerationRequested: boolean("regeneration_requested").notNull().default(false),
    regenerationSucceeded: boolean("regeneration_succeeded"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("output_feedback_opportunity_id_idx").on(t.opportunityId),
    index("output_feedback_output_id_idx").on(t.outputId),
    index("output_feedback_created_at_idx").on(t.createdAt),
  ]
);

export const exports_ = pgTable(
  "exports",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    opportunityId: varchar("opportunity_id")
      .notNull()
      .references(() => opportunities.id),
    pdfFilename: text("pdf_filename").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("exports_opportunity_id_idx").on(t.opportunityId)]
);

export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  price: text("price").notNull(),
  originalPrice: text("original_price"),
  eventLimit: integer("event_limit").notNull().default(100),
  sortOrder: integer("sort_order").default(0),
  active: boolean("active").default(true),
  isDefault: boolean("is_default").default(false),
  features: json("features").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ownerSubscriptions = pgTable("owner_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id),
  planId: varchar("plan_id").references(() => subscriptionPlans.id),
  eventsUsed: integer("events_used").default(0),
  status: text("status").notNull().default("inactive"),
  stripeSessionId: text("stripe_session_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscribedAt: timestamp("subscribed_at"),
  expirationNotified: text("expiration_notified"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subscriptionSettings = pgTable("subscription_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionGateEnabled: boolean("subscription_gate_enabled").default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const mockupSettings = pgTable("mockup_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  model: text("model").notNull().default("gemini-3-pro-image-preview"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateKey: text("template_key").notNull().unique(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  description: text("description"),
  variables: json("variables").$type<string[]>().default([]),
  active: boolean("active").default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateKey: text("template_key").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name"),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("sent"),
  errorMessage: text("error_message"),
  metadata: json("metadata").$type<Record<string, string>>(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id"),
    userName: text("user_name"),
    tenantId: varchar("tenant_id"),
    tenantName: text("tenant_name"),
    action: text("action").notNull(),
    provider: text("provider").notNull(),
    model: text("model"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    totalTokens: integer("total_tokens"),
    status: text("status").notNull().default("success"),
    errorMessage: text("error_message"),
    metadata: json("metadata").$type<Record<string, any>>(),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("activity_logs_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("activity_logs_user_id_idx").on(t.userId),
  ]
);

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertOpportunitySchema = createInsertSchema(opportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertAssetSchema = createInsertSchema(assets).omit({ id: true, createdAt: true });
export const insertSignSpecSchema = createInsertSchema(signSpecs).omit({
  id: true,
  createdAt: true,
});
export const insertPlaneSchema = createInsertSchema(planes).omit({ id: true, createdAt: true });
export const insertProductRuleSchema = createInsertSchema(productRules).omit({ id: true });
export const insertSignTypeReferenceSchema = createInsertSchema(signTypeReferences).omit({
  id: true,
  createdAt: true,
});
export const insertSignTypeExampleSchema = createInsertSchema(signTypeExamples).omit({
  id: true,
  createdAt: true,
});
export const insertMockupFeedbackSchema = createInsertSchema(mockupFeedback).omit({
  id: true,
  createdAt: true,
});
export const insertOutputSchema = createInsertSchema(outputs).omit({ id: true, createdAt: true });
export const insertOutputFeedbackSchema = createInsertSchema(outputFeedback).omit({
  id: true,
  createdAt: true,
});
export const insertSignTypeSchema = createInsertSchema(signTypes).omit({
  id: true,
  createdAt: true,
});
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
});
export const insertOwnerSubscriptionSchema = createInsertSchema(ownerSubscriptions).omit({
  id: true,
  createdAt: true,
});
export const insertSubscriptionSettingsSchema = createInsertSchema(subscriptionSettings).omit({
  id: true,
});
export const insertMockupSettingsSchema = createInsertSchema(mockupSettings).omit({
  id: true,
});
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({ id: true, sentAt: true });
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    actorId: varchar("actor_id").notNull(),
    actorEmail: text("actor_email"),
    tenantId: varchar("tenant_id"),
    action: text("action").notNull(),
    targetId: varchar("target_id"),
    targetType: text("target_type"),
    ip: text("ip"),
    payload: json("payload").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("admin_audit_log_actor_idx").on(t.actorId),
    index("admin_audit_log_tenant_created_idx").on(t.tenantId, t.createdAt),
  ]
);

export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLog).omit({
  id: true,
  createdAt: true,
});

export * from "./models/chat";

export const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type SignSpec = typeof signSpecs.$inferSelect;
export type InsertSignSpec = z.infer<typeof insertSignSpecSchema>;
export type Plane = typeof planes.$inferSelect;
export type InsertPlane = z.infer<typeof insertPlaneSchema>;
export type ProductRule = typeof productRules.$inferSelect;
export type InsertProductRule = z.infer<typeof insertProductRuleSchema>;
export type SignTypeReference = typeof signTypeReferences.$inferSelect;
export type InsertSignTypeReference = z.infer<typeof insertSignTypeReferenceSchema>;
export type SignTypeExample = typeof signTypeExamples.$inferSelect;
export type InsertSignTypeExample = z.infer<typeof insertSignTypeExampleSchema>;
export type MockupFeedback = typeof mockupFeedback.$inferSelect;
export type InsertMockupFeedback = z.infer<typeof insertMockupFeedbackSchema>;
export type Output = typeof outputs.$inferSelect;
export type InsertOutput = z.infer<typeof insertOutputSchema>;
export type OutputFeedback = typeof outputFeedback.$inferSelect;
export type InsertOutputFeedback = z.infer<typeof insertOutputFeedbackSchema>;
export type SignType = typeof signTypes.$inferSelect;
export type InsertSignType = z.infer<typeof insertSignTypeSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type OwnerSubscription = typeof ownerSubscriptions.$inferSelect;
export type InsertOwnerSubscription = z.infer<typeof insertOwnerSubscriptionSchema>;
export type SubscriptionSettings = typeof subscriptionSettings.$inferSelect;
export type InsertSubscriptionSettings = z.infer<typeof insertSubscriptionSettingsSchema>;
export type MockupSettings = typeof mockupSettings.$inferSelect;
export type InsertMockupSettings = z.infer<typeof insertMockupSettingsSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

export const BUDGET_LABELS: Record<string, string> = {
  "0_500": "$0 - $500",
  "500_1K": "$500 - $1,000",
  "1K_2K": "$1,000 - $2,000",
  "2K_5K": "$2,000 - $5,000",
  "5K_10K": "$5,000 - $10,000",
  "10K_PLUS": "$10,000+",
};

export const OPPORTUNITY_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  WON: "Won",
  LOST: "Lost",
  FOLLOW_UP: "Follow-up",
};

export const REQUIRED_FOOTER =
  "Note on Scale: These visualizations are for conceptual sales purposes only. Sizes have been estimated based on standard architectural ratios. A physical site survey is required to confirm final dimensions and mounting requirements before fabrication.";

export const processedStripeEvents = pgTable("processed_stripe_events", {
  eventId: text("event_id").primaryKey(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export * from "./models/auth";
