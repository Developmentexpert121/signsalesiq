/**
 * Export Seed Script
 * -----------------
 * Dumps all data from the current database to `seed-export.json`.
 *
 * Usage:
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/export-seed.ts
 *
 * The output file can be committed to the repo or transferred manually
 * and then loaded by `scripts/import-seed.ts` in a new environment.
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

const OUTPUT_FILE = path.resolve(process.cwd(), "seed-export.json");

async function exportAll() {
  console.log("Starting full database export...\n");

  const data: Record<string, any[]> = {};

  const tables: { name: string; table: any }[] = [
    { name: "tenants", table: tenants },
    { name: "signTypes", table: signTypes },
    { name: "subscriptionPlans", table: subscriptionPlans },
    { name: "subscriptionSettings", table: subscriptionSettings },
    { name: "emailTemplates", table: emailTemplates },
    { name: "users", table: users },
    { name: "passwordResetTokens", table: passwordResetTokens },
    { name: "ownerSubscriptions", table: ownerSubscriptions },
    { name: "opportunities", table: opportunities },
    { name: "assets", table: assets },
    { name: "signSpecs", table: signSpecs },
    { name: "planes", table: planes },
    { name: "outputs", table: outputs },
    { name: "exports", table: exportsTable },
    { name: "productRules", table: productRules },
    { name: "signTypeReferences", table: signTypeReferences },
    { name: "mockupFeedback", table: mockupFeedback },
    { name: "emailLogs", table: emailLogs },
    { name: "activityLogs", table: activityLogs },
  ];

  let totalRows = 0;

  for (const { name, table } of tables) {
    try {
      const rows = await db.select().from(table);
      data[name] = rows;
      totalRows += rows.length;
      console.log(`  ✓ ${name.padEnd(25)} ${rows.length} rows`);
    } catch (err: any) {
      console.warn(`  ⚠ ${name.padEnd(25)} SKIPPED (${err.message})`);
      data[name] = [];
    }
  }

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    totalRows,
    tables: Object.keys(data),
    data,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(exportPayload, null, 2));

  console.log(`\n✅ Export complete!`);
  console.log(`   File  : ${OUTPUT_FILE}`);
  console.log(`   Tables: ${Object.keys(data).length}`);
  console.log(`   Rows  : ${totalRows}`);
}

exportAll()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Export failed:", err);
    process.exit(1);
  });
