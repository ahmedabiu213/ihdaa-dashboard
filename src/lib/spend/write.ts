import "server-only";
import { and, between, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type SpendRow = typeof schema.spendDaily.$inferInsert;
export type EntityRow = { level: "campaign" | "adset" | "ad"; externalId: string; parentExternalId: string | null; name: string | null; status: string | null };

export async function upsertAdAccount(platform: string, a: { id: string; name?: string | null; currency?: string | null; timezone?: string | null }) {
  await getDb().insert(schema.adAccounts)
    .values({ platform, externalId: a.id, name: a.name ?? null, currency: a.currency ?? null, timezone: a.timezone ?? null })
    .onConflictDoUpdate({
      target: [schema.adAccounts.platform, schema.adAccounts.externalId],
      set: { name: a.name ?? null, currency: a.currency ?? null, timezone: a.timezone ?? null },
    });
}

export async function upsertEntities(platform: string, accountId: string, rows: EntityRow[]) {
  if (rows.length === 0) return;
  const values = rows.map((r) => ({ ...r, platform, accountExternalId: accountId, updatedAt: new Date() }));
  for (let i = 0; i < values.length; i += 500) {
    await getDb().insert(schema.adEntities).values(values.slice(i, i + 500)).onConflictDoUpdate({
      target: [schema.adEntities.platform, schema.adEntities.level, schema.adEntities.externalId],
      set: {
        name: sql`coalesce(excluded.name, ${schema.adEntities.name})`, status: sql`coalesce(excluded.status, ${schema.adEntities.status})`,
        parentExternalId: sql`coalesce(excluded.parent_external_id, ${schema.adEntities.parentExternalId})`, updatedAt: new Date(),
      },
    });
  }
}

/** Replace a platform's synced rows for one account and date window, so corrections and zeroed days stick. */
export async function replaceApiSpend(platform: string, accountId: string, from: string, to: string, rows: SpendRow[], source: "api" | "script" = "api") {
  await getDb().transaction(async (tx) => {
    await tx.delete(schema.spendDaily).where(and(
      eq(schema.spendDaily.platform, platform), eq(schema.spendDaily.source, source),
      eq(schema.spendDaily.accountExternalId, accountId), between(schema.spendDaily.date, from, to),
    ));
    for (let i = 0; i < rows.length; i += 500) await tx.insert(schema.spendDaily).values(rows.slice(i, i + 500));
  });
}
