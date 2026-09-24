import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Idempotent runtime schema migrations.
 *
 * Runs once at startup, before `seedDatabase()`. Every statement uses
 * `IF NOT EXISTS` (or equivalent) so it is safe to run on every deploy and
 * on every server restart. This is the source of truth for live schema
 * changes — drizzle-kit push is interactive and the `migrations/` folder
 * does not exist on this project, so neither runs reliably on DigitalOcean.
 *
 * To add a new column / index / table, append a new SQL statement here.
 * Never remove statements (they remain idempotent forever).
 */
export async function runStartupMigrations(): Promise<void> {
  const statements: { name: string; sql: string }[] = [
    // 2026-05-15: SignSuiteIQ provisioning receiver — extra user profile fields
    // and soft-archive flag.
    { name: "users.username", sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS username text` },
    { name: "users.job_title", sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title text` },
    { name: "users.location", sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS location text` },
    {
      name: "users.deleted_at",
      sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamp`,
    },

    // 2026-05-15: Map a SignSuiteIQ "company" 1:1 to a SignSalesIQ tenant so SSO/
    // provisioning can attach new users to the correct organization automatically.
    {
      name: "tenants.signsuiteiq_company_id",
      sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS signsuiteiq_company_id integer`,
    },
    {
      name: "tenants.signsuiteiq_company_id.unique",
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS tenants_signsuiteiq_company_id_unique ON tenants (signsuiteiq_company_id) WHERE signsuiteiq_company_id IS NOT NULL`,
    },
  ];

  let applied = 0;
  let skipped = 0;
  for (const stmt of statements) {
    try {
      await db.execute(sql.raw(stmt.sql));
      applied++;
    } catch (err: any) {
      // IF NOT EXISTS makes these no-ops on re-run; only real errors land here.
      console.error(`[startup-migrate] failed ${stmt.name}: ${err?.message || err}`);
      skipped++;
    }
  }
  console.log(`[startup-migrate] complete — ${applied} statement(s) ran, ${skipped} failed`);
}
