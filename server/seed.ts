import {
  activityLogs,
  assets,
  emailLogs,
  emailTemplates,
  exports_ as exportsTable,
  mockupFeedback,
  opportunities,
  outputs,
  ownerSubscriptions,
  passwordResetTokens,
  planes,
  productRules,
  signSpecs,
  signTypeReferences,
  signTypes,
  subscriptionPlans,
  subscriptionSettings,
  tenants,
  users,
} from "@shared/schema";
import bcrypt from "bcrypt";
import { count, eq, getTableColumns, isNull, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { db } from "./db";
import { env } from "./env";
import { REFERENCE_IMAGE_SEED_DATA } from "./seedReferenceData";
import { SIGN_TYPE_SEED_DATA } from "./seedSignTypeData";
import { storage } from "./storage";

import { logger } from "./logger";
async function autoImportSeedFile(): Promise<boolean> {
  // Look for seed file next to the running binary first (dist/), then project root
  const candidates = [
    path.resolve(path.dirname(process.argv[1] ?? ""), "seed-export.json"),
    path.resolve(process.cwd(), "seed-export.json"),
    path.resolve(process.cwd(), "dist", "seed-export.json"),
  ];
  const seedFile = candidates.find((f) => fs.existsSync(f));
  if (!seedFile) {
    logger.info("[AutoSeed] seed-export.json not found — skipping.");
    return false;
  }

  const raw = fs.readFileSync(seedFile, "utf-8");
  const payload = JSON.parse(raw);
  const d = payload.data as Record<string, any[]>;

  const BATCH = 100;

  // Drizzle expects Date objects for timestamp columns, but JSON gives strings.
  // This pre-processes every row and converts ISO date strings to Date objects.
  function normalizeRow(row: Record<string, any>): Record<string, any> {
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
    return Object.fromEntries(
      Object.entries(row).map(([k, v]) => {
        if (typeof v === "string" && ISO_DATE.test(v)) return [k, new Date(v)];
        return [k, v];
      })
    );
  }

  // upsertRows: true upsert for Phase 1 config tables.
  // conflictTarget: the column(s) to use for ON CONFLICT detection.
  //   - Use the natural unique key (e.g. signTypes.name, emailTemplates.templateKey)
  //     so records sync correctly even when the production DB has the same data
  //     with different auto-generated IDs.
  //   - Defaults to table.id if not specified.
  async function upsertRows(name: string, table: any, rows: any[], conflictTarget?: any) {
    if (!rows || rows.length === 0) return;
    const normalized = rows.map(normalizeRow);

    const target = conflictTarget ?? (table as any).id;

    // Build ON CONFLICT DO UPDATE SET for every column except the conflict target column(s).
    const tableCols = getTableColumns(table);
    const targetNames = new Set(
      Array.isArray(target) ? target.map((c: any) => c.name) : [target.name]
    );
    const updateSet: Record<string, any> = {};
    for (const [jsName, col] of Object.entries(tableCols)) {
      if (!targetNames.has((col as any).name)) {
        updateSet[jsName] = sql`excluded.${sql.identifier((col as any).name)}`;
      }
    }

    for (let i = 0; i < normalized.length; i += BATCH) {
      const batch = normalized.slice(i, i + BATCH);
      try {
        await db.insert(table).values(batch).onConflictDoUpdate({ target, set: updateSet });
      } catch (err: any) {
        // Batch upsert failed (e.g. secondary unique constraint). Fall back row-by-row.
        for (const row of batch) {
          try {
            await db.insert(table).values(row).onConflictDoUpdate({ target, set: updateSet });
          } catch (_e: any) {
            try {
              await db.insert(table).values(row).onConflictDoNothing();
            } catch (_: any) {}
          }
        }
      }
    }
    logger.info(`[AutoSeed]   ↺ Config synced: ${name} (${rows.length} rows)`);
  }

  // ── PHASE 1: Config tables — always synced on every startup ──────────────
  // These have no FK constraints and are safe to upsert at any time.
  // This ensures new sign types, email templates, references, etc. always
  // make it to production even when the DB already has tenant/user data.
  //
  // IMPORTANT: use the natural unique key as the conflict target, NOT id.
  // Production DBs may have the same records with different auto-generated IDs.
  await upsertRows("signTypes", signTypes, d.signTypes || [], signTypes.name);
  await upsertRows("subscriptionPlans", subscriptionPlans, d.subscriptionPlans || []);
  await upsertRows("subscriptionSettings", subscriptionSettings, d.subscriptionSettings || []);
  await upsertRows(
    "emailTemplates",
    emailTemplates,
    d.emailTemplates || [],
    emailTemplates.templateKey
  );
  await upsertRows("signTypeReferences", signTypeReferences, d.signTypeReferences || []);
  await upsertRows("mockupFeedback", mockupFeedback, d.mockupFeedback || []);

  // ── PHASE 2: Tenant/user/operational data ────────────────────────────────
  // Runs automatically on a fresh (empty) DB.
  // Set FORCE_SEED=true to force a full re-import on an existing DB
  // (safe: all inserts use ON CONFLICT DO NOTHING, no data is overwritten).
  const forceSeed = env.FORCE_SEED?.toLowerCase() === "true";
  const [{ total }] = await db.select({ total: count() }).from(tenants);

  if (total > 0 && !forceSeed) {
    logger.info(
      "[AutoSeed] Existing tenant data detected — config synced, operational data preserved."
    );
    logger.info(
      "[AutoSeed]   Tip: set FORCE_SEED=true to force a full re-import from seed-export.json."
    );
    return false;
  }

  if (forceSeed && total > 0) {
    logger.info(
      `[AutoSeed] FORCE_SEED=true — running full import on existing DB (${total} tenants). All inserts are idempotent.`
    );
  } else {
    logger.info("[AutoSeed] Fresh database detected. Importing all operational data...");
  }

  // ── Helper: insert rows with row-by-row fallback on batch failure ──────
  // Tracks "already exists" (ON CONFLICT) vs genuine FK/constraint errors
  // separately so log messages are accurate and not misleading.
  async function insertRows(
    name: string,
    table: any,
    rows: any[],
    transform?: (row: Record<string, any>) => Record<string, any>
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const normalized = rows.map((r) => (transform ? transform(normalizeRow(r)) : normalizeRow(r)));
    let inserted = 0;
    let fkErrors = 0;
    for (let i = 0; i < normalized.length; i += BATCH) {
      const batch = normalized.slice(i, i + BATCH);
      try {
        const result = await db
          .insert(table)
          .values(batch)
          .onConflictDoNothing()
          .returning({ id: (table as any).id });
        inserted += result.length;
      } catch (err: any) {
        // Batch failed (FK / constraint violation rolls back the whole batch).
        // Fall back row-by-row so valid rows still land.
        for (const row of batch) {
          try {
            const r = await db
              .insert(table)
              .values(row)
              .onConflictDoNothing()
              .returning({ id: (table as any).id });
            inserted += r.length;
          } catch (_e: any) {
            fkErrors++; // genuine constraint failure — not a uniqueness conflict
          }
        }
      }
    }
    // alreadyExist = rows silently skipped by ON CONFLICT DO NOTHING (already in DB)
    const alreadyExist = rows.length - inserted - fkErrors;
    const parts: string[] = [];
    if (fkErrors > 0) parts.push(`${fkErrors} skipped — FK refs not found`);
    if (alreadyExist > 0) parts.push(`${alreadyExist} already exist`);
    const suffix = parts.length > 0 ? ` (${parts.join(", ")})` : "";
    logger.info(`[AutoSeed]   ✓ ${name} (${inserted}/${rows.length} rows${suffix})`);
    return inserted;
  }

  let totalImported = 0;

  // ── Pass A: anchor tables (tenants + users) ──────────────────────────────
  // Insert these first so we can build seed-UUID → production-UUID maps.
  // Production may already have these with DIFFERENT UUIDs (from seedTenantsAndUsers
  // on a prior deployment), so ON CONFLICT DO NOTHING silently skips them.
  totalImported += await insertRows("tenants", tenants, d.tenants || []);
  totalImported += await insertRows("users", users, d.users || []);

  // ── Build ID maps: seed UUID → actual production UUID ────────────────────
  // After the inserts above, query the DB by natural key (slug / email) to
  // find the canonical IDs used in production — regardless of whether the
  // seed rows were inserted fresh or already existed.
  const tenantIdMap: Record<string, string> = {};
  const userIdMap: Record<string, string> = {};

  for (const row of d.tenants || []) {
    const [prod] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, row.slug));
    if (prod) tenantIdMap[row.id] = prod.id;
  }
  for (const row of d.users || []) {
    const [prod] = await db.select({ id: users.id }).from(users).where(eq(users.email, row.email));
    if (prod) userIdMap[row.id] = prod.id;
  }

  // ── remapFKs: rewrite seed UUIDs to production UUIDs in FK columns ───────
  // Fields covered:
  //   ownerId   → production user id (opportunities)
  //   userId    → production user id (passwordResetTokens, ownerSubscriptions)
  //   tenantId  → production tenant id (opportunities, ownerSubscriptions, productRules)
  // All other FK columns (opportunityId, signSpecId, assetId, etc.) reference
  // seed-inserted rows whose IDs we control, so they need no remapping.
  function remapFKs(row: Record<string, any>): Record<string, any> {
    const r = { ...row };
    if (r.ownerId && userIdMap[r.ownerId]) r.ownerId = userIdMap[r.ownerId];
    if (r.userId && userIdMap[r.userId]) r.userId = userIdMap[r.userId];
    if (r.tenantId && tenantIdMap[r.tenantId]) r.tenantId = tenantIdMap[r.tenantId];
    return r;
  }

  // ── Pass B: remaining tables (FK-remapped where needed) ──────────────────
  totalImported += await insertRows(
    "passwordResetTokens",
    passwordResetTokens,
    d.passwordResetTokens || [],
    remapFKs
  );
  totalImported += await insertRows(
    "ownerSubscriptions",
    ownerSubscriptions,
    d.ownerSubscriptions || [],
    remapFKs
  );
  totalImported += await insertRows(
    "opportunities",
    opportunities,
    d.opportunities || [],
    remapFKs
  );
  totalImported += await insertRows("assets", assets, d.assets || []);
  totalImported += await insertRows("signSpecs", signSpecs, d.signSpecs || []);
  totalImported += await insertRows("planes", planes, d.planes || []);
  totalImported += await insertRows("outputs", outputs, d.outputs || []);
  totalImported += await insertRows("exports", exportsTable, d.exports || []);
  // Global product rules (tenantId=null) are owned and managed by
  // seedGlobalRulesForAllSignTypes() which deduplicates them on every startup.
  // Importing them here would cause a churn cycle: seed inserts them, dedup
  // deletes the duplicates, next FORCE_SEED re-inserts them, repeat.
  // Only import tenant-specific overrides here.
  const tenantSpecificRules = (d.productRules || []).filter((r: any) => r.tenantId != null);
  totalImported += await insertRows(
    "productRules (tenant-specific)",
    productRules,
    tenantSpecificRules,
    remapFKs
  );
  totalImported += await insertRows("emailLogs", emailLogs, d.emailLogs || []);
  totalImported += await insertRows("activityLogs", activityLogs, d.activityLogs || []);

  logger.info(`[AutoSeed] ✅ Full import complete — ${totalImported} rows loaded.`);
  return true;
}

export async function seedDatabase() {
  await autoImportSeedFile();

  try {
    const existingAdmin = await storage.getUserByEmail("admin");
    const existingTypes = await storage.getSignTypes();

    // Always run user/tenant seeding — it's idempotent and safe on every deployment
    await seedTenantsAndUsers();

    if (!existingAdmin) {
      await seedRules();
    } else if (existingAdmin.role !== "SUPER_ADMIN") {
      await storage.updateUser(existingAdmin.id, { role: "SUPER_ADMIN" as any });
      logger.info("Upgraded admin user to SUPER_ADMIN");
    }

    if (existingTypes.length === 0) {
      await seedSignTypes();
    } else {
      await syncMissingSignTypes(existingTypes);
      await syncSignTypeDescriptions(existingTypes);
    }

    await seedGlobalRulesForAllSignTypes();

    await seedReferenceImages();
  } catch (e: any) {
    logger.error("Seed database error (tables may not exist yet - run drizzle push):", e.message);
  }
}

async function seedSignTypes() {
  logger.info("Seeding sign types...");
  for (const st of SIGN_TYPE_SEED_DATA) {
    await storage.createSignType({
      name: st.name,
      label: st.label,
      category: st.category,
      description: st.description,
      attributes: [...st.attributes],
      sortOrder: st.sortOrder,
      active: st.active,
      generationNotes: st.generationNotes ?? null,
    });
  }
  logger.info("Sign types seeded successfully");
}

async function seedTenantsAndUsers() {
  logger.info("Seeding tenants and users...");

  const ADMIN_PASSWORD = env.SEED_ADMIN_PASSWORD ?? "1waltham";
  const DEFAULT_USER_PASSWORD = env.SEED_USER_PASSWORD ?? "SignSales2025!";

  // --- All tenants to seed (idempotent by slug) ---
  const TENANT_SEED_DATA = [
    {
      slug: "default",
      name: "Default Tenant",
      phone: null,
      email: null,
      address: null,
      website: null,
    },
    {
      slug: "fastsigns-plaistow",
      name: "FASTSIGNS Plaistow",
      phone: "6038947446",
      email: "2219@fastsigns.com",
      address: "160 Plaistow Rd Unit 15, Plaistow, NH 03865",
      website: "https://www.fastsigns.com/plaistow-nh/",
    },
    {
      slug: "fs-waltham",
      name: "FASTSIGNS of Waltham",
      phone: "781-642-7446",
      email: "waltham@fastsigns.com",
      address: "922 Main Street Waltham MA 02451",
      website: "fastsigns.com/waltham",
    },
    {
      slug: "fastsigns.com/221",
      name: "FASTSIGNS DTC",
      phone: "3037320878",
      email: "b.williams@fastsigns.com",
      address: "S10697 E. Briarwood Cir. Centennial, CO 80112",
      website: "fastsigns.com/221",
    },
    {
      slug: "fastsigns.com/lancaster-pa/",
      name: "FASTSIGNS Lancaster",
      phone: "7172837071",
      email: "wes.kauffman@concordiaholdco.com",
      address: "1811 Rohrerstown Rd., Suite 2, Lancaster, PA 17601",
      website: "https://www.fastsigns.com/lancaster-pa/",
    },
    {
      slug: "fastsigns-of-saratoga-springs",
      name: "FASTSIGNS of Saratoga Springs",
      phone: "518-306-4449",
      email: "2029@fastsigns.com",
      address: "30 Gick Road, Saratoga Springs NY 12866",
      website: "www.fastsigns.com/2029",
    },
    {
      slug: "fastsigns-of-newington",
      name: "FASTSIGNS® of Newington",
      phone: "8604707936",
      email: "2191@fastsigns.com",
      address: "2434 Berlin Tpk Newington, CT 06111",
      website: "www.fastsigns.com/2191",
    },
    {
      slug: "test-owner",
      name: "Test Owner",
      phone: "617 694 1115",
      email: "vjkalwani@yahoo.com",
      address: "51 Wild Rose Drive",
      website: null,
    },
    {
      slug: "fastsigns-waltham",
      name: "FastSigns of Waltham",
      phone: "781-642-7446",
      email: null,
      address: "922 Main Street Waltham MA 02451",
      website: null,
    },
  ];

  const tenantMap: Record<string, string> = {};

  for (const t of TENANT_SEED_DATA) {
    let existing = await storage.getTenantBySlug(t.slug);
    if (!existing) {
      existing = await storage.createTenant({ ...t, active: true });
      logger.info(`Created tenant: ${t.name} (${t.slug})`);
    }
    tenantMap[t.slug] = existing.id;
  }

  // --- SUPER_ADMIN accounts (no tenant) ---
  const SUPER_ADMIN_ACCOUNTS = [
    { email: "admin", name: "Super Admin", role: "SUPER_ADMIN" as const },
    {
      email: "developmentexpert121@gmail.com",
      name: "Development Expert",
      role: "SUPER_ADMIN" as const,
    },
  ];

  for (const acct of SUPER_ADMIN_ACCOUNTS) {
    const existing = await storage.getUserByEmail(acct.email);
    if (!existing) {
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await storage.createUser({
        name: acct.name,
        email: acct.email,
        passwordHash,
        role: acct.role,
      });
      logger.info({ email: acct.email }, "created SUPER_ADMIN");
    } else if (existing.role !== acct.role) {
      await storage.updateUser(existing.id, { role: acct.role });
      logger.info({ email: acct.email }, "upgraded to SUPER_ADMIN");
    }
  }

  // --- Tenant-linked accounts ---
  // tenantSlug: which tenant to assign on creation (skipped if user already has a tenant)
  const TENANT_USER_ACCOUNTS: {
    email: string;
    name: string;
    role: "ADMIN" | "SALES";
    tenantSlug: string;
  }[] = [
    { email: "tenantadmin", name: "Tenant Admin", role: "ADMIN", tenantSlug: "default" },
    { email: "sales", name: "Sales User", role: "SALES", tenantSlug: "default" },
    {
      email: "vj.ohol@fastsigns.com",
      name: "Vikas Ohol",
      role: "ADMIN",
      tenantSlug: "fastsigns-plaistow",
    },
    {
      email: "lorena.filian@fastsigns.com",
      name: "Lorena Filian",
      role: "SALES",
      tenantSlug: "fastsigns-plaistow",
    },
    {
      email: "smehta@fastsigns.com",
      name: "Shishir Mehta",
      role: "ADMIN",
      tenantSlug: "fs-waltham",
    },
    {
      email: "travis.martin@fastsigns.com",
      name: "Travis Martin",
      role: "SALES",
      tenantSlug: "fs-waltham",
    },
    {
      email: "john.dowd@fastsigns.com",
      name: "John Dowd",
      role: "SALES",
      tenantSlug: "fs-waltham",
    },
    { email: "vishnu", name: "Vishnu", role: "SALES", tenantSlug: "fs-waltham" },
    {
      email: "brendan.donovan@fastsigns.com",
      name: "Brendan Donovan",
      role: "SALES",
      tenantSlug: "fs-waltham",
    },
    {
      email: "b.williams@fastsigns.com",
      name: "Buddy Williams",
      role: "ADMIN",
      tenantSlug: "fastsigns.com/221",
    },
    {
      email: "wes.kauffman@concordiaholdco.com",
      name: "Wes Kauffman",
      role: "ADMIN",
      tenantSlug: "fastsigns.com/lancaster-pa/",
    },
    {
      email: "rick.bult@fastsigns.com",
      name: "Rick Bult",
      role: "ADMIN",
      tenantSlug: "fastsigns-of-saratoga-springs",
    },
    {
      email: "joel.miller@fastsigns.com",
      name: "Joel Miller",
      role: "ADMIN",
      tenantSlug: "fastsigns-of-newington",
    },
    {
      email: "vjkalwani@yahoo.com",
      name: "Vipul Kalwani",
      role: "ADMIN",
      tenantSlug: "test-owner",
    },
    { email: "syncuser", name: "Sync User", role: "SALES", tenantSlug: "test-owner" },
  ];

  for (const acct of TENANT_USER_ACCOUNTS) {
    const tenantId = tenantMap[acct.tenantSlug];
    const existing = await storage.getUserByEmail(acct.email);
    if (!existing) {
      const passwordHash = await bcrypt.hash(DEFAULT_USER_PASSWORD, 10);
      await storage.createUser({
        name: acct.name,
        email: acct.email,
        passwordHash,
        role: acct.role,
        tenantId,
      });
      logger.info(
        { role: acct.role, email: acct.email, tenant: acct.tenantSlug },
        "created account"
      );
    } else if (!existing.tenantId && tenantId) {
      await storage.updateUser(existing.id, { tenantId });
      logger.info({ email: acct.email, tenant: acct.tenantSlug }, "linked account to tenant");
    }
  }

  logger.info("Users and tenants seeded successfully.");
}

async function seedRules() {
  logger.info("Seeding rules...");
  const rules = [
    {
      locationType: "EXTERIOR",
      signType: "CHANNEL_LETTERS_FRONT_LIT",
      budgetRange: "2K_5K",
      goodProducts: [
        "Standard Aluminum Channel Letters",
        "Basic LED Module Kit",
        "Standard Raceway Mount",
      ],
      betterProducts: [
        "Premium Aluminum Channel Letters",
        "Samsung LED Modules",
        "Custom Color Raceway",
      ],
      bestProducts: [
        "Stainless Steel Channel Letters",
        "High-Output LEDs with Dimmer",
        "Hidden Raceway System",
      ],
    },
    {
      locationType: "EXTERIOR",
      signType: "CHANNEL_LETTERS_BACK_LIT_HALO",
      budgetRange: "10K_PLUS",
      goodProducts: ["Aluminum Halo Letters", "Standard LED Backlight", "Standoff Mounts"],
      betterProducts: ["Brushed Aluminum Halo Letters", "RGB LED Backlight", "Custom Standoffs"],
      bestProducts: [
        "Polished Stainless Halo Letters",
        "Smart RGB LED System",
        "Engineered Mount System",
      ],
    },
    {
      locationType: "EXTERIOR",
      signType: "MONUMENT_MED_4x6",
      budgetRange: "2K_5K",
      goodProducts: ["Standard Monument Cabinet", "Vinyl Graphics", "Basic LED Illumination"],
      betterProducts: [
        "Custom Monument Structure",
        "Digital Print with Overlay",
        "Premium LED Package",
      ],
      bestProducts: [
        "Architectural Monument",
        "Dimensional Letters on Monument",
        "Smart Lighting System",
      ],
    },
    {
      locationType: "INTERIOR",
      signType: "DIMENSIONAL_LETTERS",
      budgetRange: "1K_2K",
      goodProducts: ["Painted PVC Letters", "Standard Stud Mount", "Basic Layout"],
      betterProducts: ["Brushed Aluminum Letters", "Pin Mount System", "Designer Layout"],
      bestProducts: ["Custom Metal Letters", "LED Edge-Lit Mount", "Premium Layout with Backing"],
    },
    {
      locationType: "EXTERIOR",
      signType: "STOREFRONT_PAN_SIGN_FLAT",
      budgetRange: "1K_2K",
      goodProducts: ["Flat Pan Sign Cabinet", "Vinyl Face", "External Gooseneck Lights"],
      betterProducts: ["Deep Pan Cabinet", "Polycarbonate Face", "Internal LED Illumination"],
      bestProducts: ["Custom Pan with Returns", "Push-Through Acrylic Face", "Edge-Lit LED System"],
    },
    {
      locationType: "INTERIOR",
      signType: "ADA",
      budgetRange: "500_1K",
      goodProducts: ["Standard ADA Plaque", "Grade 2 Braille", "Basic Mounting"],
      betterProducts: ["Custom ADA Plaque", "Photo Insert ADA", "Standoff Mount"],
      bestProducts: ["Architectural ADA Suite", "Custom Shape ADA", "Integrated Wayfinding"],
    },
    {
      locationType: "EXTERIOR",
      signType: "BANNERS",
      budgetRange: "0_500",
      goodProducts: ["Standard Vinyl Banner", "Grommets", "Basic Design"],
      betterProducts: ["Heavy-Duty Mesh Banner", "Pole Pockets", "Professional Design"],
      bestProducts: [
        "Double-Sided Fabric Banner",
        "Wind Slits + Hardware",
        "Premium Design Package",
      ],
    },
  ];
  for (const rule of rules) {
    await storage.createRule(rule as any);
  }
  logger.info("Database seeded successfully");
}

async function syncSignTypeDescriptions(existingTypes: any[]) {
  const existingMap = new Map(existingTypes.map((t: any) => [t.name, t]));
  let updated = 0;
  for (const st of SIGN_TYPE_SEED_DATA) {
    const existing = existingMap.get(st.name);
    if (!existing) continue;
    const generationNotes = st.generationNotes ?? null;
    const needsUpdate =
      existing.description !== st.description || existing.generationNotes !== generationNotes;
    if (needsUpdate) {
      await storage.updateSignType(existing.id, {
        description: st.description,
        generationNotes,
      });
      updated++;
    }
  }
  if (updated > 0) {
    logger.info(`Updated descriptions/generationNotes for ${updated} sign types`);
  }
}

async function syncMissingSignTypes(existingTypes: any[]) {
  const existingNames = new Set(existingTypes.map((t) => t.name));
  const missing = SIGN_TYPE_SEED_DATA.filter((st) => !existingNames.has(st.name));
  if (missing.length === 0) return;

  logger.info(`Adding ${missing.length} missing sign types...`);
  for (const st of missing) {
    await storage.createSignType({
      name: st.name,
      label: st.label,
      category: st.category,
      description: st.description,
      attributes: [...st.attributes],
      sortOrder: st.sortOrder,
      active: st.active,
      generationNotes: st.generationNotes ?? null,
    });
  }
  logger.info("Missing sign types added successfully");
}

async function seedGlobalRulesForAllSignTypes() {
  const allTypes = await storage.getSignTypes();
  const activeTypes = allTypes.filter((t) => t.active !== false);
  const existingGlobalRules = await db
    .select()
    .from(productRules)
    .where(isNull(productRules.tenantId));

  const keepIds = new Set<string>();
  const seenSignTypes = new Set<string>();
  for (const r of existingGlobalRules) {
    if (!seenSignTypes.has(r.signType)) {
      seenSignTypes.add(r.signType);
      keepIds.add(r.id);
    }
  }
  const dupeIds = existingGlobalRules.filter((r) => !keepIds.has(r.id)).map((r) => r.id);
  if (dupeIds.length > 0) {
    for (const id of dupeIds) {
      await storage.deleteRule(id);
    }
    logger.info(`Removed ${dupeIds.length} duplicate global rules (keeping 1 per sign type)`);
  }

  const keptRules = existingGlobalRules.filter((r) => keepIds.has(r.id));
  let normalized = 0;
  for (const r of keptRules) {
    if (r.budgetRange !== "0_500" || JSON.stringify(r.enabledTiers) !== '["GOOD"]') {
      await storage.updateRule(r.id, {
        budgetRange: "0_500",
        enabledTiers: ["GOOD"],
        goodProducts: r.goodProducts?.length ? r.goodProducts : ["Standard Option"],
        betterProducts: ["Enhanced Option"],
        bestProducts: ["Premium Option"],
      });
      normalized++;
    }
  }
  if (normalized > 0) {
    logger.info(`Normalized ${normalized} global rules to standard template format`);
  }

  let created = 0;
  for (const st of activeTypes) {
    if (!seenSignTypes.has(st.name)) {
      await storage.createRule({
        locationType: st.category as any,
        signType: st.name,
        budgetRange: "0_500" as any,
        goodProducts: ["Standard Option"],
        betterProducts: ["Enhanced Option"],
        bestProducts: ["Premium Option"],
        enabledTiers: ["GOOD"],
        tenantId: null,
      } as any);
      created++;
    }
  }
  if (created > 0) {
    logger.info(`Created ${created} global product rules for sign types missing coverage`);
  }
}

async function seedReferenceImages() {
  const result = await db.select({ total: count() }).from(signTypeReferences);
  const total = result[0].total;
  if (total >= REFERENCE_IMAGE_SEED_DATA.length) return;

  logger.info(
    `Seeding reference images (${total} exist, ${REFERENCE_IMAGE_SEED_DATA.length} expected)...`
  );
  const batchSize = 50;
  for (let i = 0; i < REFERENCE_IMAGE_SEED_DATA.length; i += batchSize) {
    const batch = REFERENCE_IMAGE_SEED_DATA.slice(i, i + batchSize);
    await db
      .insert(signTypeReferences)
      .values(
        batch.map((r) => ({
          id: r.id,
          signType: r.signType,
          filename: r.filename,
          label: r.label,
          mimeType: r.mimeType,
        }))
      )
      .onConflictDoNothing();
  }
  logger.info("Reference images seeded successfully");
}
