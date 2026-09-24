import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { env } from "./env";

const doUrl = env.DO_DATABASE_URL;
const isExternalDb = !!doUrl;
export const dbConnectionString = doUrl ?? env.DATABASE_URL;

if (isExternalDb) {
  // Required for Digital Ocean managed PostgreSQL which uses a self-signed CA certificate chain.
  // The pool-level ssl.rejectUnauthorized alone does not bypass the CA chain check in Node.js.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export const pool = new Pool({
  connectionString: dbConnectionString,
  ssl: isExternalDb ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
});

export const db = drizzle(pool, { schema });
