import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { normalizeSallaOrder } from "./normalize-salla";
import { upsertOrder, type UpsertResult } from "./upsert";
import type { OrderSource } from "./types";

/** Store the raw body first, then normalize and merge. Raw bodies allow re-processing after a parser fix. */
export async function ingestSallaPayload(body: unknown, source: OrderSource, event: string | null, forcedStatus: string | null = null) {
  const db = getDb();
  const [ev] = await db.insert(schema.webhookEvents)
    .values({ source, event, payload: body as object })
    .returning({ id: schema.webhookEvents.id });
  try {
    const list = Array.isArray(body) ? body : [body];
    const results: UpsertResult[] = [];
    for (const item of list) {
      const n = normalizeSallaOrder(item, source);
      if (forcedStatus) { n.status = forcedStatus; n.hasAmount = false; }
      results.push(await upsertOrder(n));
    }
    await db.update(schema.webhookEvents).set({ processed: true }).where(eq(schema.webhookEvents.id, ev.id));
    return results;
  } catch (e) {
    await db.update(schema.webhookEvents)
      .set({ error: e instanceof Error ? e.message : String(e) })
      .where(eq(schema.webhookEvents.id, ev.id));
    throw e;
  }
}
