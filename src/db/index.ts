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
  try {
    new URL(url);
  } catch {
    // Never echo the value: it contains the database password.
    throw new Error(
      "DATABASE_URL is not a valid URL. Common causes: the [YOUR-PASSWORD] placeholder or its brackets are still there, " +
        "the password contains @ # / ? % : and is not URL-encoded, or the value has quotes or spaces around it.",
    );
  }
  const client = postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10 });
  // postgres.js sends parameterless queries with the "simple" protocol and the rest with the
  // "extended" one. Mixing both on one pipelined connection stalls Supabase's transaction-mode
  // pooler (Supavisor), so every query goes through the extended protocol.
  const unsafe = client.unsafe.bind(client);
  client.unsafe = ((query: string, params?: unknown[], options?: Record<string, unknown>) =>
    unsafe(query, params as never, { ...options, simple: false } as never)) as typeof client.unsafe;
  globalThis.__db = drizzle({ client, schema });
  return globalThis.__db;
}

export { schema };
