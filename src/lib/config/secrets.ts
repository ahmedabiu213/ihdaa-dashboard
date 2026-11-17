import "server-only";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured, schema } from "@/db";

type Cached = { value: string | null; at: number };
const cache = new Map<string, Cached>();
const TTL_MS = 60_000;

/**
 * A secret from the Vercel environment, or else from the app_secrets table.
 * The repository is public, so secrets never go in the code; the table is the
 * fallback for when the environment variable isn't reaching the deployment.
 */
export async function getSecret(name: string): Promise<{ value: string | null; from: "env" | "database" | null }> {
  const env = process.env[name]?.trim();
  if (env) return { value: env, from: "env" };
  if (!isDatabaseConfigured()) return { value: null, from: null };
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < TTL_MS) return { value: hit.value, from: hit.value ? "database" : null };
  const [row] = await getDb().select({ value: schema.appSecrets.value }).from(schema.appSecrets)
    .where(eq(schema.appSecrets.name, name)).limit(1);
  const value = row?.value.trim() || null;
  cache.set(name, { value, at: Date.now() });
  return { value, from: value ? "database" : null };
}

/** Names that have a database fallback (for the settings check; values are never returned). */
export async function databaseSecretNames(): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await getDb().select({ name: schema.appSecrets.name }).from(schema.appSecrets);
  return rows.map((r) => r.name);
}
