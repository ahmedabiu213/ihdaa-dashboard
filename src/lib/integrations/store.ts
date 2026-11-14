import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

const { integrations, syncRuns } = schema;
export type Integration = typeof integrations.$inferSelect;

export async function getIntegration(platform: string): Promise<Integration | null> {
  const [row] = await getDb().select().from(integrations).where(eq(integrations.platform, platform));
  return row ?? null;
}

export async function saveIntegration(platform: string, values: Partial<Omit<Integration, "platform">>) {
  await getDb().insert(integrations)
    .values({ platform, ...values, updatedAt: new Date() })
    .onConflictDoUpdate({ target: integrations.platform, set: { ...values, updatedAt: new Date() } });
}

export async function recentRuns(platform: string, limit = 5) {
  return getDb().select().from(syncRuns).where(eq(syncRuns.platform, platform)).orderBy(desc(syncRuns.startedAt)).limit(limit);
}

/** Wrap a sync so every run is logged with its outcome. */
export async function logRun<T extends { rows: number }>(platform: string, fn: () => Promise<T>): Promise<T> {
  const db = getDb();
  const [run] = await db.insert(syncRuns).values({ platform, status: "running" }).returning({ id: syncRuns.id });
  try {
    const result = await fn();
    await db.update(syncRuns).set({ status: "ok", rows: result.rows, finishedAt: new Date() }).where(eq(syncRuns.id, run.id));
    await saveIntegration(platform, { lastSyncAt: new Date(), lastError: null, status: "connected" });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.update(syncRuns).set({ status: "error", error: message.slice(0, 2000), finishedAt: new Date() }).where(eq(syncRuns.id, run.id));
    await saveIntegration(platform, { lastError: message.slice(0, 2000), status: "error" });
    throw e;
  }
}
