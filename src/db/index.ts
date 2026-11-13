import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;

declare global {
  var __db: DB | undefined;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Lazily created so the app can build and render a setup screen before
 * DATABASE_URL exists. Supabase's transaction pooler (port 6543) does not
 * support prepared statements, hence `prepare: false`.
 */
export function getDb(): DB {
  if (globalThis.__db) return globalThis.__db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { prepare: false, max: 3, idle_timeout: 20 });
  globalThis.__db = drizzle({ client, schema });
  return globalThis.__db;
}

export { schema };
