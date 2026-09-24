import { insertOpportunitySchema } from "@shared/schema";

export const createOpportunitySchema = insertOpportunitySchema.omit({
  tenantId: true,
  ownerId: true,
});

export const updateOpportunitySchema = createOpportunitySchema.partial();
