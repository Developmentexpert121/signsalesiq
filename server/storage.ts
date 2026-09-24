import { eq, desc, asc, and, isNull, or, gt } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  opportunities,
  assets,
  planes,
  productRules,
  outputs,
  exports_,
  signTypeReferences,
  signTypeExamples,
  signTypes,
  tenants,
  signSpecs,
  subscriptionPlans,
  ownerSubscriptions,
  subscriptionSettings,
  emailTemplates,
  emailLogs,
  activityLogs,
  passwordResetTokens,
  mockupFeedback,
  outputFeedback,
  type OutputFeedback,
  type InsertOutputFeedback,
  type User,
  type InsertUser,
  type Opportunity,
  type InsertOpportunity,
  type Asset,
  type InsertAsset,
  type Plane,
  type InsertPlane,
  type ProductRule,
  type InsertProductRule,
  type Output,
  type InsertOutput,
  type SignTypeReference,
  type InsertSignTypeReference,
  type SignTypeExample,
  type InsertSignTypeExample,
  type MockupFeedback,
  type InsertMockupFeedback,
  type SignType,
  type InsertSignType,
  type Tenant,
  type InsertTenant,
  type SignSpec,
  type InsertSignSpec,
  type SubscriptionPlan,
  type InsertSubscriptionPlan,
  type OwnerSubscription,
  type InsertOwnerSubscription,
  type SubscriptionSettings,
  type InsertSubscriptionSettings,
  mockupSettings,
  type MockupSettings,
  type InsertMockupSettings,
  type EmailTemplate,
  type InsertEmailTemplate,
  type EmailLog,
  type InsertEmailLog,
  type ActivityLog,
  type InsertActivityLog,
  type PasswordResetToken,
  type InsertPasswordResetToken,
} from "@shared/schema";
import { count } from "drizzle-orm";

/**
 * Returns the most recently created asset of the given type, or undefined if
 * none exist. `getAssets` is unordered and per-spec uploads can leave multiple
 * CANVAS/LOGO assets behind, so callers that want "the current photo" must pick
 * the newest rather than `assets.find(...)` (which returns an arbitrary one).
 */
export function latestAssetOfType(assets: Asset[], type: Asset["type"]): Asset | undefined {
  return assets
    .filter((a) => a.type === type)
    .reduce<Asset | undefined>((latest, a) => {
      if (!latest) return a;
      return new Date(a.createdAt).getTime() >= new Date(latest.createdAt).getTime() ? a : latest;
    }, undefined);
}

export interface IStorage {
  getTenants(): Promise<Tenant[]>;
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  getTenantBySignSuiteIQCompanyId(companyId: number): Promise<Tenant | undefined>;
  createTenant(data: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined>;
  deleteTenant(id: string): Promise<void>;

  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserBySignSuiteIQId(signsuiteiqUserId: number): Promise<User | undefined>;
  getUsersByTenant(tenantId: string): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  archiveUserByEmail(email: string): Promise<User | undefined>;

  getOpportunities(ownerId?: string): Promise<Opportunity[]>;
  getOpportunitiesByTenant(tenantId: string): Promise<Opportunity[]>;
  getOpportunitiesPaginated(opts: {
    tenantId?: string;
    ownerId?: string;
    limit: number;
    cursor?: string;
  }): Promise<{ data: Opportunity[]; nextCursor: string | null }>;
  getOpportunity(id: string): Promise<Opportunity | undefined>;
  createOpportunity(data: InsertOpportunity): Promise<Opportunity>;
  updateOpportunity(id: string, data: Partial<InsertOpportunity>): Promise<Opportunity | undefined>;
  deleteOpportunity(id: string): Promise<void>;

  getAssets(opportunityId: string): Promise<Asset[]>;
  getAsset(id: string): Promise<Asset | undefined>;
  createAsset(data: InsertAsset): Promise<Asset>;
  deleteAsset(id: string): Promise<void>;
  deleteAssetsByType(opportunityId: string, type: string): Promise<void>;

  getSignSpecs(opportunityId: string): Promise<SignSpec[]>;
  getSignSpec(id: string): Promise<SignSpec | undefined>;
  createSignSpec(data: InsertSignSpec): Promise<SignSpec>;
  updateSignSpec(id: string, data: Partial<InsertSignSpec>): Promise<SignSpec | undefined>;
  deleteSignSpec(id: string): Promise<void>;

  getPlane(opportunityId: string): Promise<Plane | undefined>;
  getPlanesByOpportunity(opportunityId: string): Promise<Plane[]>;
  getPlaneBySignSpec(signSpecId: string): Promise<Plane | undefined>;
  savePlane(data: InsertPlane): Promise<Plane>;
  deletePlaneBySignSpec(signSpecId: string): Promise<void>;
  deletePlaneByOpportunity(opportunityId: string): Promise<void>;

  getRules(tenantId?: string | null): Promise<ProductRule[]>;
  getGlobalRules(): Promise<ProductRule[]>;
  getRulesByTenant(tenantId: string): Promise<ProductRule[]>;
  getRule(id: string): Promise<ProductRule | undefined>;
  findRule(
    locationType: string,
    signType: string,
    budgetRange: string,
    tenantId?: string | null
  ): Promise<ProductRule | undefined>;
  createRule(data: InsertProductRule): Promise<ProductRule>;
  updateRule(id: string, data: Partial<InsertProductRule>): Promise<ProductRule | undefined>;
  deleteRule(id: string): Promise<void>;

  getOutputs(opportunityId: string): Promise<Output[]>;
  getOutputsBySignSpec(signSpecId: string): Promise<Output[]>;
  getOutput(id: string): Promise<Output | undefined>;
  createOutput(data: InsertOutput): Promise<Output>;
  updateOutput(id: string, data: Partial<InsertOutput>): Promise<Output | undefined>;
  deleteOutputs(opportunityId: string): Promise<void>;
  deleteOutputsBySignSpec(signSpecId: string): Promise<void>;
  createExport(data: { opportunityId: string; pdfFilename: string }): Promise<any>;

  createOutputFeedback(data: InsertOutputFeedback): Promise<OutputFeedback>;
  updateOutputFeedback(
    id: string,
    data: Partial<InsertOutputFeedback>
  ): Promise<OutputFeedback | undefined>;
  getOutputFeedbackByOpportunity(opportunityId: string): Promise<OutputFeedback[]>;

  getSignTypeReferences(signType: string): Promise<SignTypeReference[]>;
  getAllSignTypeReferences(): Promise<SignTypeReference[]>;
  createSignTypeReference(data: InsertSignTypeReference): Promise<SignTypeReference>;
  updateSignTypeReference(
    id: string,
    data: { label?: string; signType?: string; isPrimary?: boolean }
  ): Promise<SignTypeReference>;
  deleteSignTypeReference(id: string): Promise<void>;

  getSignTypeExamples(signType: string, opts?: { limit?: number }): Promise<SignTypeExample[]>;
  getAllSignTypeExamples(): Promise<SignTypeExample[]>;
  createSignTypeExample(data: InsertSignTypeExample): Promise<SignTypeExample>;
  updateSignTypeExample(
    id: string,
    data: Partial<
      Pick<InsertSignTypeExample, "label" | "signType" | "exampleInput" | "sortOrder" | "active">
    >
  ): Promise<SignTypeExample>;
  deleteSignTypeExample(id: string): Promise<void>;
  getApprovedFeedbackImages(signType: string, limit?: number): Promise<MockupFeedback[]>;
  getNeedsWorkSummary(
    signType: string,
    limit?: number
  ): Promise<{ areas: string[]; notes: string[] }>;

  createMockupFeedback(data: InsertMockupFeedback): Promise<MockupFeedback>;
  getMockupFeedback(signType?: string): Promise<MockupFeedback[]>;
  getMockupFeedbackStats(): Promise<
    {
      signType: string;
      signTypeLabel: string;
      total: number;
      approved: number;
      needsWork: number;
      areaCounts: Record<string, number>;
    }[]
  >;
  deleteMockupFeedback(id: string): Promise<void>;

  getSignTypes(): Promise<SignType[]>;
  getSignType(id: string): Promise<SignType | undefined>;
  getSignTypeByName(name: string): Promise<SignType | undefined>;
  createSignType(data: InsertSignType): Promise<SignType>;
  updateSignType(id: string, data: Partial<InsertSignType>): Promise<SignType | undefined>;
  deleteSignType(id: string): Promise<void>;

  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getActiveSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  getDefaultSubscriptionPlan(): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(data: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(
    id: string,
    data: Partial<InsertSubscriptionPlan>
  ): Promise<SubscriptionPlan | undefined>;
  deleteSubscriptionPlan(id: string): Promise<void>;

  getOwnerSubscriptions(): Promise<any[]>;
  getOwnerSubscription(tenantId: string): Promise<OwnerSubscription | undefined>;
  getOwnerSubscriptionByUserId(userId: string): Promise<OwnerSubscription | undefined>;
  upsertOwnerSubscription(
    tenantId: string,
    data: Partial<InsertOwnerSubscription>
  ): Promise<OwnerSubscription>;
  upsertOwnerSubscriptionByUserId(
    userId: string,
    data: Partial<InsertOwnerSubscription>
  ): Promise<OwnerSubscription>;

  incrementOpportunityUsage(tenantId: string): Promise<void>;

  getAllActiveSubscriptions(): Promise<any[]>;
  updateExpirationNotified(subId: string, value: string): Promise<void>;

  getSubscriptionSettings(): Promise<SubscriptionSettings | undefined>;
  updateSubscriptionSettings(
    data: Partial<InsertSubscriptionSettings>
  ): Promise<SubscriptionSettings>;

  getMockupSettings(): Promise<MockupSettings | undefined>;
  updateMockupSettings(data: Partial<InsertMockupSettings>): Promise<MockupSettings>;

  getEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  getEmailTemplateByKey(key: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(data: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(
    id: string,
    data: Partial<InsertEmailTemplate>
  ): Promise<EmailTemplate | undefined>;

  getEmailLogs(limit?: number): Promise<EmailLog[]>;
  createEmailLog(data: InsertEmailLog): Promise<EmailLog>;

  getActivityLogs(limit?: number, offset?: number): Promise<ActivityLog[]>;
  getActivityLogCount(): Promise<number>;
  createActivityLog(data: InsertActivityLog): Promise<ActivityLog>;

  createPasswordResetToken(data: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getTenants() {
    return db.select().from(tenants).orderBy(tenants.name);
  }

  async getTenant(id: string) {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, id));
    return t;
  }

  async getTenantBySlug(slug: string) {
    const [t] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return t;
  }

  async getTenantBySignSuiteIQCompanyId(companyId: number) {
    const [t] = await db.select().from(tenants).where(eq(tenants.signsuiteiqCompanyId, companyId));
    return t;
  }

  async createTenant(data: InsertTenant) {
    const [t] = await db.insert(tenants).values(data).returning();
    return t;
  }

  async updateTenant(id: string, data: Partial<InsertTenant>) {
    const [t] = await db.update(tenants).set(data).where(eq(tenants.id, id)).returning();
    return t;
  }

  async deleteTenant(id: string) {
    const tenantOpps = await db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(eq(opportunities.tenantId, id));
    for (const opp of tenantOpps) {
      await this.deleteOpportunity(opp.id);
    }
    await db.delete(ownerSubscriptions).where(eq(ownerSubscriptions.tenantId, id));
    await db.delete(productRules).where(eq(productRules.tenantId, id));
    await db.delete(users).where(eq(users.tenantId, id));
    await db.delete(tenants).where(eq(tenants.id, id));
  }

  async getUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
    return user;
  }

  async getUserBySignSuiteIQId(signsuiteiqUserId: number) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.signsuiteiqUserId, signsuiteiqUserId));
    return user;
  }

  async getUsersByTenant(tenantId: string) {
    return db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), isNull(users.deletedAt)))
      .orderBy(users.name);
  }

  async getAllUsers() {
    return db.select().from(users).where(isNull(users.deletedAt)).orderBy(users.name);
  }

  async createUser(data: InsertUser) {
    const normalized = { ...data, email: data.email.trim().toLowerCase() };
    const [user] = await db.insert(users).values(normalized).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>) {
    const normalized = data.email ? { ...data, email: data.email.trim().toLowerCase() } : data;
    const [user] = await db.update(users).set(normalized).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string) {
    await db.delete(users).where(eq(users.id, id));
  }

  async archiveUserByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    const [user] = await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.email, normalized))
      .returning();
    return user;
  }

  async getOpportunities(ownerId?: string) {
    if (ownerId) {
      return db
        .select()
        .from(opportunities)
        .where(eq(opportunities.ownerId, ownerId))
        .orderBy(desc(opportunities.createdAt));
    }
    return db.select().from(opportunities).orderBy(desc(opportunities.createdAt));
  }

  async getOpportunitiesByTenant(tenantId: string) {
    return db
      .select()
      .from(opportunities)
      .where(eq(opportunities.tenantId, tenantId))
      .orderBy(desc(opportunities.createdAt));
  }

  async getOpportunitiesPaginated({
    tenantId,
    ownerId,
    limit,
    cursor,
  }: {
    tenantId?: string;
    ownerId?: string;
    limit: number;
    cursor?: string;
  }) {
    const conditions = [];
    if (tenantId) conditions.push(eq(opportunities.tenantId, tenantId));
    if (ownerId) conditions.push(eq(opportunities.ownerId, ownerId));
    if (cursor) conditions.push(gt(opportunities.id, cursor));

    const rows = await db
      .select()
      .from(opportunities)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(opportunities.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;
    return { data, nextCursor };
  }

  async getOpportunity(id: string) {
    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, id));
    return opp;
  }

  async createOpportunity(data: InsertOpportunity) {
    const [opp] = await db.insert(opportunities).values(data).returning();
    return opp;
  }

  async updateOpportunity(id: string, data: Partial<InsertOpportunity>) {
    const [opp] = await db
      .update(opportunities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(opportunities.id, id))
      .returning();
    return opp;
  }

  async deleteOpportunity(id: string) {
    await db.delete(outputFeedback).where(eq(outputFeedback.opportunityId, id));
    await db.delete(exports_).where(eq(exports_.opportunityId, id));
    await db.delete(outputs).where(eq(outputs.opportunityId, id));
    await db.delete(planes).where(eq(planes.opportunityId, id));
    await db.delete(signSpecs).where(eq(signSpecs.opportunityId, id));
    await db.delete(assets).where(eq(assets.opportunityId, id));
    await db.delete(opportunities).where(eq(opportunities.id, id));
  }

  async getAssets(opportunityId: string) {
    return db.select().from(assets).where(eq(assets.opportunityId, opportunityId));
  }

  async getAsset(id: string) {
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));
    return asset;
  }

  async createAsset(data: InsertAsset) {
    const [asset] = await db.insert(assets).values(data).returning();
    return asset;
  }

  async deleteAsset(id: string) {
    await db.delete(assets).where(eq(assets.id, id));
  }

  async deleteAssetsByType(opportunityId: string, type: string) {
    await db
      .delete(assets)
      .where(and(eq(assets.opportunityId, opportunityId), eq(assets.type, type as any)));
  }

  async getSignSpecs(opportunityId: string) {
    return db
      .select()
      .from(signSpecs)
      .where(eq(signSpecs.opportunityId, opportunityId))
      .orderBy(signSpecs.sortOrder, signSpecs.createdAt);
  }

  async getSignSpec(id: string) {
    const [spec] = await db.select().from(signSpecs).where(eq(signSpecs.id, id));
    return spec;
  }

  async createSignSpec(data: InsertSignSpec) {
    const [spec] = await db.insert(signSpecs).values(data).returning();
    return spec;
  }

  async updateSignSpec(id: string, data: Partial<InsertSignSpec>) {
    const [spec] = await db.update(signSpecs).set(data).where(eq(signSpecs.id, id)).returning();
    return spec;
  }

  async deleteSignSpec(id: string) {
    const spec = await this.getSignSpec(id);
    await db.delete(outputs).where(eq(outputs.signSpecId, id));
    await db.delete(planes).where(eq(planes.signSpecId, id));
    await db.delete(signSpecs).where(eq(signSpecs.id, id));

    if (!spec) return;

    const remainingSpecs = await this.getSignSpecs(spec.opportunityId);
    const candidateAssetIds = [spec.canvasAssetId, spec.logoAssetId].filter(
      (assetId): assetId is string => !!assetId
    );
    for (const assetId of new Set(candidateAssetIds)) {
      const stillReferenced = remainingSpecs.some(
        (remaining) =>
          remaining.canvasAssetId === assetId || remaining.logoAssetId === assetId
      );
      if (!stillReferenced) {
        await db.delete(assets).where(eq(assets.id, assetId));
      }
    }
  }

  async getPlane(opportunityId: string) {
    const [plane] = await db
      .select()
      .from(planes)
      .where(eq(planes.opportunityId, opportunityId))
      .orderBy(desc(planes.createdAt))
      .limit(1);
    return plane;
  }

  async getPlanesByOpportunity(opportunityId: string) {
    return db
      .select()
      .from(planes)
      .where(eq(planes.opportunityId, opportunityId))
      .orderBy(desc(planes.createdAt));
  }

  async getPlaneBySignSpec(signSpecId: string) {
    const [plane] = await db
      .select()
      .from(planes)
      .where(eq(planes.signSpecId, signSpecId))
      .orderBy(desc(planes.createdAt))
      .limit(1);
    return plane;
  }

  async savePlane(data: InsertPlane) {
    const [plane] = await db.insert(planes).values(data).returning();
    return plane;
  }

  async deletePlaneBySignSpec(signSpecId: string) {
    await db.delete(planes).where(eq(planes.signSpecId, signSpecId));
  }

  async deletePlaneByOpportunity(opportunityId: string) {
    await db
      .delete(planes)
      .where(and(eq(planes.opportunityId, opportunityId), isNull(planes.signSpecId)));
  }

  async getRules(tenantId?: string | null) {
    if (tenantId) {
      return db
        .select()
        .from(productRules)
        .where(or(eq(productRules.tenantId, tenantId), isNull(productRules.tenantId)));
    }
    return db.select().from(productRules);
  }

  async getGlobalRules() {
    return db.select().from(productRules).where(isNull(productRules.tenantId));
  }

  async getRulesByTenant(tenantId: string) {
    return db.select().from(productRules).where(eq(productRules.tenantId, tenantId));
  }

  async getRule(id: string) {
    const [rule] = await db.select().from(productRules).where(eq(productRules.id, id));
    return rule;
  }

  async findRule(
    locationType: string,
    signType: string,
    budgetRange: string,
    tenantId?: string | null
  ) {
    if (tenantId) {
      const [tenantRule] = await db
        .select()
        .from(productRules)
        .where(
          and(
            eq(productRules.tenantId, tenantId),
            eq(productRules.locationType, locationType as any),
            eq(productRules.signType, signType as any),
            eq(productRules.budgetRange, budgetRange as any)
          )
        );
      if (tenantRule) return tenantRule;
    }
    const [exactGlobal] = await db
      .select()
      .from(productRules)
      .where(
        and(
          isNull(productRules.tenantId),
          eq(productRules.locationType, locationType as any),
          eq(productRules.signType, signType as any),
          eq(productRules.budgetRange, budgetRange as any)
        )
      );
    if (exactGlobal) return exactGlobal;
    const [anyGlobal] = await db
      .select()
      .from(productRules)
      .where(
        and(
          isNull(productRules.tenantId),
          eq(productRules.locationType, locationType as any),
          eq(productRules.signType, signType as any)
        )
      );
    return anyGlobal;
  }

  async createRule(data: InsertProductRule) {
    const [rule] = await db.insert(productRules).values(data).returning();
    return rule;
  }

  async updateRule(id: string, data: Partial<InsertProductRule>) {
    const [rule] = await db
      .update(productRules)
      .set(data)
      .where(eq(productRules.id, id))
      .returning();
    return rule;
  }

  async deleteRule(id: string) {
    await db.delete(productRules).where(eq(productRules.id, id));
  }

  async getOutputs(opportunityId: string) {
    return db.select().from(outputs).where(eq(outputs.opportunityId, opportunityId));
  }

  async getOutputsBySignSpec(signSpecId: string) {
    return db.select().from(outputs).where(eq(outputs.signSpecId, signSpecId));
  }

  async getOutput(id: string) {
    const [output] = await db.select().from(outputs).where(eq(outputs.id, id));
    return output;
  }

  async createOutput(data: InsertOutput) {
    const [output] = await db.insert(outputs).values(data).returning();
    return output;
  }

  async updateOutput(id: string, data: Partial<InsertOutput>) {
    const [output] = await db.update(outputs).set(data).where(eq(outputs.id, id)).returning();
    return output;
  }

  async deleteOutputs(opportunityId: string) {
    await db.delete(outputs).where(eq(outputs.opportunityId, opportunityId));
  }

  async deleteOutputsBySignSpec(signSpecId: string) {
    await db.delete(outputs).where(eq(outputs.signSpecId, signSpecId));
  }

  async createExport(data: { opportunityId: string; pdfFilename: string }) {
    const [exp] = await db.insert(exports_).values(data).returning();
    return exp;
  }

  async getSignTypeReferences(signType: string) {
    return db
      .select()
      .from(signTypeReferences)
      .where(eq(signTypeReferences.signType, signType as any))
      .orderBy(desc(signTypeReferences.createdAt));
  }

  async getAllSignTypeReferences() {
    return db.select().from(signTypeReferences).orderBy(desc(signTypeReferences.createdAt));
  }

  async createSignTypeReference(data: InsertSignTypeReference) {
    const [ref] = await db.insert(signTypeReferences).values(data).returning();
    return ref;
  }

  async updateSignTypeReference(
    id: string,
    data: { label?: string; signType?: string; isPrimary?: boolean }
  ) {
    const [ref] = await db
      .update(signTypeReferences)
      .set(data)
      .where(eq(signTypeReferences.id, id))
      .returning();
    return ref;
  }

  async deleteSignTypeReference(id: string) {
    await db.delete(signTypeReferences).where(eq(signTypeReferences.id, id));
  }

  async getSignTypeExamples(signType: string, opts?: { limit?: number }) {
    const query = db
      .select()
      .from(signTypeExamples)
      .where(and(eq(signTypeExamples.signType, signType), eq(signTypeExamples.active, true)))
      .orderBy(asc(signTypeExamples.sortOrder), desc(signTypeExamples.createdAt));
    return opts?.limit ? query.limit(opts.limit) : query;
  }

  async getAllSignTypeExamples() {
    return db
      .select()
      .from(signTypeExamples)
      .orderBy(asc(signTypeExamples.signType), asc(signTypeExamples.sortOrder));
  }

  async createSignTypeExample(data: InsertSignTypeExample) {
    const [row] = await db.insert(signTypeExamples).values(data).returning();
    return row;
  }

  async updateSignTypeExample(
    id: string,
    data: Partial<
      Pick<InsertSignTypeExample, "label" | "signType" | "exampleInput" | "sortOrder" | "active">
    >
  ) {
    const [row] = await db
      .update(signTypeExamples)
      .set(data)
      .where(eq(signTypeExamples.id, id))
      .returning();
    return row;
  }

  async deleteSignTypeExample(id: string) {
    await db.delete(signTypeExamples).where(eq(signTypeExamples.id, id));
  }

  async getApprovedFeedbackImages(signType: string, limit = 4): Promise<MockupFeedback[]> {
    return db
      .select()
      .from(mockupFeedback)
      .where(and(eq(mockupFeedback.signType, signType), eq(mockupFeedback.rating, "APPROVED")))
      .orderBy(desc(mockupFeedback.createdAt))
      .limit(limit);
  }

  async getNeedsWorkSummary(
    signType: string,
    limit = 8
  ): Promise<{ areas: string[]; notes: string[] }> {
    const entries = await db
      .select()
      .from(mockupFeedback)
      .where(and(eq(mockupFeedback.signType, signType), eq(mockupFeedback.rating, "NEEDS_WORK")))
      .orderBy(desc(mockupFeedback.createdAt))
      .limit(limit);
    const areaCounts: Record<string, number> = {};
    const notes: string[] = [];
    for (const entry of entries) {
      if (entry.improvementAreas) {
        for (const area of entry.improvementAreas) {
          areaCounts[area] = (areaCounts[area] || 0) + 1;
        }
      }
      if (entry.notes?.trim()) notes.push(entry.notes.trim());
    }
    const areas = Object.entries(areaCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([area]) => area);
    return { areas, notes };
  }

  async createMockupFeedback(data: InsertMockupFeedback): Promise<MockupFeedback> {
    const [fb] = await db.insert(mockupFeedback).values(data).returning();
    return fb;
  }

  async createOutputFeedback(data: InsertOutputFeedback): Promise<OutputFeedback> {
    const [fb] = await db.insert(outputFeedback).values(data).returning();
    return fb;
  }

  async updateOutputFeedback(
    id: string,
    data: Partial<InsertOutputFeedback>
  ): Promise<OutputFeedback | undefined> {
    const [fb] = await db
      .update(outputFeedback)
      .set(data)
      .where(eq(outputFeedback.id, id))
      .returning();
    return fb;
  }

  async getOutputFeedbackByOpportunity(opportunityId: string): Promise<OutputFeedback[]> {
    return db
      .select()
      .from(outputFeedback)
      .where(eq(outputFeedback.opportunityId, opportunityId))
      .orderBy(desc(outputFeedback.createdAt));
  }

  async getMockupFeedback(signType?: string): Promise<MockupFeedback[]> {
    if (signType) {
      return db
        .select()
        .from(mockupFeedback)
        .where(eq(mockupFeedback.signType, signType))
        .orderBy(desc(mockupFeedback.createdAt));
    }
    return db.select().from(mockupFeedback).orderBy(desc(mockupFeedback.createdAt));
  }

  async getMockupFeedbackStats(): Promise<
    {
      signType: string;
      signTypeLabel: string;
      total: number;
      approved: number;
      needsWork: number;
      areaCounts: Record<string, number>;
    }[]
  > {
    const all = await db.select().from(mockupFeedback).orderBy(desc(mockupFeedback.createdAt));
    const map = new Map<
      string,
      {
        signType: string;
        signTypeLabel: string;
        total: number;
        approved: number;
        needsWork: number;
        areaCounts: Record<string, number>;
      }
    >();
    for (const fb of all) {
      if (!map.has(fb.signType)) {
        map.set(fb.signType, {
          signType: fb.signType,
          signTypeLabel: fb.signTypeLabel || fb.signType,
          total: 0,
          approved: 0,
          needsWork: 0,
          areaCounts: {},
        });
      }
      // biome-ignore lint/style/noNonNullAssertion: key was just set above if missing
      const entry = map.get(fb.signType)!;
      entry.total++;
      if (fb.rating === "APPROVED") entry.approved++;
      else {
        entry.needsWork++;
        if (fb.improvementAreas && fb.improvementAreas.length > 0) {
          for (const area of fb.improvementAreas) {
            entry.areaCounts[area] = (entry.areaCounts[area] || 0) + 1;
          }
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }

  async deleteMockupFeedback(id: string): Promise<void> {
    await db.delete(mockupFeedback).where(eq(mockupFeedback.id, id));
  }

  async getSignTypes() {
    return db.select().from(signTypes).orderBy(signTypes.sortOrder, signTypes.label);
  }

  async getSignType(id: string) {
    const [st] = await db.select().from(signTypes).where(eq(signTypes.id, id));
    return st;
  }

  async getSignTypeByName(name: string) {
    const [st] = await db.select().from(signTypes).where(eq(signTypes.name, name));
    return st;
  }

  async createSignType(data: InsertSignType) {
    const [st] = await db.insert(signTypes).values(data).returning();
    return st;
  }

  async updateSignType(id: string, data: Partial<InsertSignType>) {
    const [st] = await db.update(signTypes).set(data).where(eq(signTypes.id, id)).returning();
    return st;
  }

  async deleteSignType(id: string) {
    await db.delete(signTypes).where(eq(signTypes.id, id));
  }

  async getSubscriptionPlans() {
    return db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
  }

  async getActiveSubscriptionPlans() {
    return db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.active, true))
      .orderBy(subscriptionPlans.sortOrder);
  }

  async getSubscriptionPlan(id: string) {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan;
  }

  async getDefaultSubscriptionPlan() {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(and(eq(subscriptionPlans.isDefault, true), eq(subscriptionPlans.active, true)));
    return plan;
  }

  async createSubscriptionPlan(data: InsertSubscriptionPlan) {
    const [plan] = await db.insert(subscriptionPlans).values(data).returning();
    return plan;
  }

  async updateSubscriptionPlan(id: string, data: Partial<InsertSubscriptionPlan>) {
    const [plan] = await db
      .update(subscriptionPlans)
      .set(data)
      .where(eq(subscriptionPlans.id, id))
      .returning();
    return plan;
  }

  async deleteSubscriptionPlan(id: string) {
    await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
  }

  async getOwnerSubscriptions() {
    const rows = await db
      .select({
        id: ownerSubscriptions.id,
        tenantId: ownerSubscriptions.tenantId,
        userId: ownerSubscriptions.userId,
        planId: ownerSubscriptions.planId,
        eventsUsed: ownerSubscriptions.eventsUsed,
        status: ownerSubscriptions.status,
        subscribedAt: ownerSubscriptions.subscribedAt,
        createdAt: ownerSubscriptions.createdAt,
        tenantName: tenants.name,
        tenantEmail: tenants.email,
        userName: users.name,
        userEmail: users.email,
        planName: subscriptionPlans.name,
        planPrice: subscriptionPlans.price,
        planEventLimit: subscriptionPlans.eventLimit,
      })
      .from(ownerSubscriptions)
      .leftJoin(tenants, eq(ownerSubscriptions.tenantId, tenants.id))
      .leftJoin(users, eq(ownerSubscriptions.userId, users.id))
      .leftJoin(subscriptionPlans, eq(ownerSubscriptions.planId, subscriptionPlans.id))
      .orderBy(tenants.name);
    return rows;
  }

  async getOwnerSubscription(tenantId: string) {
    const [sub] = await db
      .select()
      .from(ownerSubscriptions)
      .where(eq(ownerSubscriptions.tenantId, tenantId));
    return sub;
  }

  async getOwnerSubscriptionByUserId(userId: string) {
    const [sub] = await db
      .select()
      .from(ownerSubscriptions)
      .where(eq(ownerSubscriptions.userId, userId));
    return sub;
  }

  async upsertOwnerSubscription(tenantId: string, data: Partial<InsertOwnerSubscription>) {
    const existing = await this.getOwnerSubscription(tenantId);
    if (existing) {
      const [updated] = await db
        .update(ownerSubscriptions)
        .set(data)
        .where(eq(ownerSubscriptions.tenantId, tenantId))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(ownerSubscriptions)
      .values({ tenantId, ...data })
      .returning();
    return created;
  }

  async upsertOwnerSubscriptionByUserId(userId: string, data: Partial<InsertOwnerSubscription>) {
    const existing = await this.getOwnerSubscriptionByUserId(userId);
    if (existing) {
      const [updated] = await db
        .update(ownerSubscriptions)
        .set(data)
        .where(eq(ownerSubscriptions.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(ownerSubscriptions)
      .values({ userId, ...data } as any)
      .returning();
    return created;
  }

  async incrementOpportunityUsage(tenantId: string) {
    const existing = await this.getOwnerSubscription(tenantId);
    if (existing) {
      await db
        .update(ownerSubscriptions)
        .set({ eventsUsed: (existing.eventsUsed || 0) + 1 })
        .where(eq(ownerSubscriptions.tenantId, tenantId));
    }
  }

  async getAllActiveSubscriptions() {
    const results = await db
      .select({
        id: ownerSubscriptions.id,
        tenantId: ownerSubscriptions.tenantId,
        userId: ownerSubscriptions.userId,
        planId: ownerSubscriptions.planId,
        status: ownerSubscriptions.status,
        subscribedAt: ownerSubscriptions.subscribedAt,
        expirationNotified: ownerSubscriptions.expirationNotified,
        planName: subscriptionPlans.name,
        tenantName: tenants.name,
        tenantEmail: tenants.email,
      })
      .from(ownerSubscriptions)
      .leftJoin(subscriptionPlans, eq(ownerSubscriptions.planId, subscriptionPlans.id))
      .leftJoin(tenants, eq(ownerSubscriptions.tenantId, tenants.id))
      .where(eq(ownerSubscriptions.status, "active"));
    return results;
  }

  async updateExpirationNotified(subId: string, value: string) {
    await db
      .update(ownerSubscriptions)
      .set({ expirationNotified: value })
      .where(eq(ownerSubscriptions.id, subId));
  }

  async getSubscriptionSettings() {
    const [settings] = await db.select().from(subscriptionSettings).limit(1);
    return settings;
  }

  async updateSubscriptionSettings(data: Partial<InsertSubscriptionSettings>) {
    const existing = await this.getSubscriptionSettings();
    if (existing) {
      const [updated] = await db
        .update(subscriptionSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(subscriptionSettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(subscriptionSettings)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return created;
  }

  async getMockupSettings() {
    const [settings] = await db.select().from(mockupSettings).limit(1);
    return settings;
  }

  async updateMockupSettings(data: Partial<InsertMockupSettings>) {
    const existing = await this.getMockupSettings();
    if (existing) {
      const [updated] = await db
        .update(mockupSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(mockupSettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(mockupSettings)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return created;
  }

  async getEmailTemplates() {
    return db.select().from(emailTemplates).orderBy(emailTemplates.name);
  }

  async getEmailTemplate(id: string) {
    const [t] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
    return t;
  }

  async getEmailTemplateByKey(key: string) {
    const [t] = await db.select().from(emailTemplates).where(eq(emailTemplates.templateKey, key));
    return t;
  }

  async createEmailTemplate(data: InsertEmailTemplate) {
    const [t] = await db.insert(emailTemplates).values(data).returning();
    return t;
  }

  async updateEmailTemplate(id: string, data: Partial<InsertEmailTemplate>) {
    const [t] = await db
      .update(emailTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(emailTemplates.id, id))
      .returning();
    return t;
  }

  async getEmailLogs(limit = 100) {
    return db.select().from(emailLogs).orderBy(desc(emailLogs.sentAt)).limit(limit);
  }

  async createEmailLog(data: InsertEmailLog) {
    const [log] = await db.insert(emailLogs).values(data).returning();
    return log;
  }

  async getActivityLogs(limit = 100, offset = 0) {
    return db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getActivityLogCount() {
    const [result] = await db.select({ count: count() }).from(activityLogs);
    return result?.count ?? 0;
  }

  async createActivityLog(data: InsertActivityLog) {
    const [log] = await db.insert(activityLogs).values(data).returning();
    return log;
  }

  async createPasswordResetToken(data: InsertPasswordResetToken) {
    const [token] = await db.insert(passwordResetTokens).values(data).returning();
    return token;
  }

  async getPasswordResetToken(token: string) {
    const [row] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return row;
  }

  async markPasswordResetTokenUsed(id: string) {
    const result = await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(and(eq(passwordResetTokens.id, id), eq(passwordResetTokens.used, false)))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
