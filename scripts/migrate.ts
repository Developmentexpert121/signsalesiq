import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const dbUrl = process.env.DO_DATABASE_URL?.trim() || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL or DO_DATABASE_URL must be set");
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });
const db = drizzle(pool);

console.log("Running migrations...");
await migrate(db, { migrationsFolder: "./migrations" });
await pool.end();
console.log("Migrations applied.");
