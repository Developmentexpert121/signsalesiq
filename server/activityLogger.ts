import { storage } from "./storage";
import type { InsertActivityLog } from "@shared/schema";

import { logger } from "./logger";
export async function logActivity(data: InsertActivityLog): Promise<void> {
  try {
    await storage.createActivityLog(data);
  } catch (err: any) {
    logger.error(`[ActivityLog] Failed to log activity: ${err.message}`);
  }
}

export interface ActorFields {
  userId?: string | null;
  userName?: string | null;
  tenantId?: string | null;
  tenantName?: string | null;
}

// Resolves denormalized user/tenant names for activity log attribution. Never throws —
// returns whatever could be looked up so logging never blocks generation.
export async function resolveActorFields(
  userId?: string | null,
  tenantId?: string | null
): Promise<ActorFields> {
  const fields: ActorFields = { userId, tenantId };
  try {
    if (userId) {
      const user = await storage.getUser(userId);
      if (user) fields.userName = user.name ?? user.email;
    }
    if (tenantId) {
      const tenant = await storage.getTenant(tenantId);
      if (tenant) fields.tenantName = tenant.name;
    }
  } catch (err: any) {
    logger.error(`[ActivityLog] Failed to resolve actor fields: ${err.message}`);
  }
  return fields;
}
