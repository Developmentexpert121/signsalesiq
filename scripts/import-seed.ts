/**
 * Import Seed Script
 * ------------------
 * Loads data from `seed-export.json` into the target database.
 * All inserts use ON CONFLICT DO NOTHING so re-running is safe.
 *
 * Usage (on the new server, after running db:push):
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/import-seed.ts
 *
 * Optional flags:
 *   --skip-logs       Skip emailLogs and activityLogs (transactional noise)
 *   --skip-users      Skip users / passwordResetTokens (if managing users separately)
 *   --only-config     Import only config tables: signTypes, productRules,
 *                     subscriptionPlans, subscriptionSettings, emailTemplates,
 *                     signTypeReferences, mockupFeedback
 *
 * Examples:
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/import-seed.ts
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/import-seed.ts --skip-logs
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/import-seed.ts --only-config
 */

import fs from "fs";
import path from "path";
import { db } from "../server/db";
import {
  tenants,
  signTypes,
  users,
  opportunities,
  assets,
  signSpecs,
  planes,
  outputs,
  exports_ as exportsTable,
  productRules,
  signTypeReferences,
  mockupFeedback,
  subscriptionPlans,
  ownerSubscriptions,
  subscriptionSettings,
  emailTemplates,
  emailLogs,
  activityLogs,
  passwordResetTokens,
} from "../shared/schema";

const INPUT_FILE = path.resolve(process.cwd(), "seed-export.json");

const args = process.argv.slice(2);
const SKIP_LOGS = args.includes("--skip-logs");
const SKIP_USERS = args.includes("--skip-users");
const ONLY_CONFIG = args.includes("--only-config");

// Drizzle expects Date objects for timestamp columns but JSON gives strings.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
function normalizeRow(row: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => {
      if (typeof v === "string" && ISO_DATE.test(v)) return [k, new Date(v)];
      return [k, v];
    })
  );
}

async function upsertBatch(name: string, table: any, rows: any[]) {
  if (!rows || rows.length === 0) {
    console.log(`  – ${name.padEnd(25)} 0 rows (skipped)`);
    return;
  }

  const BATCH = 100;
  let inserted = 0;
  const normalized = rows.map(normalizeRow);

  for (let i = 0; i < normalized.length; i += BATCH) {
    const batch = normalized.slice(i, i + BATCH);
    try {
      await db.insert(table).values(batch).onConflictDoNothing();
      inserted += batch.length;
    } catch (err: any) {
      console.warn(`  ⚠ ${name} batch ${i}–${i + BATCH} error: ${err.message}`);
    }
  }

  console.log(`  ✓ ${name.padEnd(25)} ${inserted} rows`);
}

async function importAll() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ File not found: ${INPUT_FILE}`);
    console.error("   Run export-seed.ts on the source database first.");
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT_FILE, "utf-8");
  const payload = JSON.parse(raw);
  const d = payload.data as Record<string, any[]>;

  console.log(`Loading seed export from ${payload.exportedAt}`);
  console.log(`Tables: ${payload.tables?.join(", ")}\n`);

  if (ONLY_CONFIG) {
    console.log("Mode: --only-config (config tables only)\n");
    await upsertBatch("signTypes", signTypes, d.signTypes);
    await upsertBatch("productRules", productRules, d.productRules);
    await upsertBatch("subscriptionPlans", subscriptionPlans, d.subscriptionPlans);
    await upsertBatch("subscriptionSettings", subscriptionSettings, d.subscriptionSettings);
    await upsertBatch("emailTemplates", emailTemplates, d.emailTemplates);
    await upsertBatch("signTypeReferences", signTypeReferences, d.signTypeReferences);
    await upsertBatch("mockupFeedback", mockupFeedback, d.mockupFeedback);
  } else {
    console.log(
      `Flags: ${SKIP_LOGS ? "--skip-logs " : ""}${SKIP_USERS ? "--skip-users" : "(all)"}\n`
    );

    // 1. No-dependency tables
    await upsertBatch("tenants", tenants, d.tenants);
    await upsertBatch("signTypes", signTypes, d.signTypes);
    await upsertBatch("subscriptionPlans", subscriptionPlans, d.subscriptionPlans);
    await upsertBatch("subscriptionSettings", subscriptionSettings, d.subscriptionSettings);
    await upsertBatch("emailTemplates", emailTemplates, d.emailTemplates);
    await upsertBatch("signTypeReferences", signTypeReferences, d.signTypeReferences);
    await upsertBatch("mockupFeedback", mockupFeedback, d.mockupFeedback);

    // 2. Depends on tenants
    if (!SKIP_USERS) {
      await upsertBatch("users", users, d.users);
      await upsertBatch("passwordResetTokens", passwordResetTokens, d.passwordResetTokens);
    }

    // 3. Depends on tenants + users + plans
    await upsertBatch("ownerSubscriptions", ownerSubscriptions, d.ownerSubscriptions);

    // 4. Depends on users + tenants
    await upsertBatch("opportunities", opportunities, d.opportunities);

    // 5. Depends on opportunities
    await upsertBatch("assets", assets, d.assets);

    // 6. Depends on opportunities + assets
    await upsertBatch("signSpecs", signSpecs, d.signSpecs);

    // 7. Depends on opportunities + signSpecs
    await upsertBatch("planes", planes, d.planes);
    await upsertBatch("outputs", outputs, d.outputs);
    await upsertBatch("exports", exportsTable, d.exports);

    // 8. Depends on tenants (can be null)
    await upsertBatch("productRules", productRules, d.productRules);

    // 9. Transactional logs — skippable
    if (!SKIP_LOGS) {
      await upsertBatch("emailLogs", emailLogs, d.emailLogs);
      await upsertBatch("activityLogs", activityLogs, d.activityLogs);
    }
  }

  console.log("\n✅ Import complete!");
}

importAll()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
