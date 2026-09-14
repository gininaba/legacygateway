import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

let poolInstance: Pool | null = null;

if (databaseUrl) {
  try {
    const isCloudPg =
      databaseUrl.includes("supabase") ||
      databaseUrl.includes("neon") ||
      databaseUrl.includes("vercel-storage") ||
      databaseUrl.includes("pooler.supabase.com");

    poolInstance =
      globalForDb.__arenaNextJsPostgresqlPool ??
      new Pool({
        connectionString: databaseUrl,
        ssl: isCloudPg ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 5000,
      });

    if (process.env.NODE_ENV !== "production" && poolInstance) {
      globalForDb.__arenaNextJsPostgresqlPool = poolInstance;
    }
  } catch (e) {
    console.error("Database pool initialization warning:", e);
  }
}

export const pool = poolInstance;
export const db = pool ? drizzle(pool) : (null as unknown as ReturnType<typeof drizzle>);
