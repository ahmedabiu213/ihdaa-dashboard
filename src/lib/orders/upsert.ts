import "server-only";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { riyadhDay } from "@/lib/dates";
import { VERIFIED_SOURCES, countsAsRevenue, type NormalizedOrder } from "./types";

const { orders, orderItems, products, attributions } = schema;

export type UpsertResult = { orderId: number; action: "created" | "updated" | "skipped" };

/**
 * Insert or merge one order, matched by Salla id OR reference number.
 *
 * Merge rules:
 * - Verified data (Salla) overwrites everything, including browser-reported amounts.
 * - Unverified data (browser) never overwrites a verified order; it only fills
 *   in an id the order was missing.
 * - Items are replaced whenever the incoming data is allowed to overwrite.
 */
export async function upsertOrder(n: NormalizedOrder): Promise<UpsertResult> {
  if (n.sallaId == null && n.referenceId == null) throw new Error("order has neither id nor reference");
  const verified = VERIFIED_SOURCES.includes(n.source);
  const db = getDb();

  return db.transaction(async (tx) => {
    // The browser may report Salla's internal id where we expect the reference
    // (or vice versa), so every known key is checked against both columns.
    const keys = [...new Set([n.sallaId, n.referenceId].filter((k) => k != null && k !== "").map(String))];
    const matchers = keys.flatMap((k) => [
      eq(orders.referenceId, k),
      ...(/^\d{1,15}$/.test(k) ? [eq(orders.sallaId, Number(k))] : []),
    ]);
    let existing = await tx.select().from(orders).where(or(...matchers)).for("update");

    // Verified data with only Salla's internal id (an invoice) can't match the order number the
    // store script reported. Merge it into that unverified report instead of counting it twice:
    // same amount, placed within 2 hours before to 30 minutes after.
    if (existing.length === 0 && verified && n.referenceId == null && n.sallaId != null && n.totalSar > 0) {
      const from = new Date(n.orderedAt.getTime() - 2 * 3600_000);
      const to = new Date(n.orderedAt.getTime() + 30 * 60_000);
      existing = await tx.select().from(orders)
        .where(sql`${orders.verified} = false and ${orders.sallaId} is null and ${orders.totalSar} = ${n.totalSar.toFixed(2)}
          and ${orders.orderedAt} between ${from.toISOString()}::timestamptz and ${to.toISOString()}::timestamptz`)
        .orderBy(sql`abs(extract(epoch from ${orders.orderedAt} - ${n.orderedAt.toISOString()}::timestamptz))`).limit(1).for("update");
    }

    // Two rows can match when the browser created one by reference and Salla
    // later sends id+reference that another row holds. Keep the verified/oldest one.
    existing.sort((a, b) => Number(b.verified) - Number(a.verified) || a.id - b.id);
    const [keep, ...dupes] = existing;
    for (const d of dupes) {
      // Deleting the duplicate unlinks its attribution (ON DELETE SET NULL); the
      // relink step below then attaches one attribution to the kept order.
      await tx.delete(orders).where(eq(orders.id, d.id));
    }

    const values = {
      sallaId: n.sallaId ?? keep?.sallaId ?? null,
      referenceId: n.referenceId ?? keep?.referenceId ?? null,
      status: n.status,
      countsAsRevenue: countsAsRevenue(n.status),
      totalSar: n.totalSar.toFixed(2),
      currency: n.currency,
      paymentMethod: n.paymentMethod,
      source: n.source,
      verified,
      orderedAt: n.orderedAt,
      orderedDate: riyadhDay(n.orderedAt),
      raw: n.raw as object,
      updatedAt: new Date(),
    };

    let orderId: number;
    let action: UpsertResult["action"];
    if (!keep && n.hasAmount === false) {
      throw new Error("partial order event (no amount) for an order not seen yet: saved, not counted");
    }
    if (!keep) {
      const [row] = await tx.insert(orders).values(values).returning({ id: orders.id });
      orderId = row.id;
      action = "created";
    } else if (n.hasAmount === false) {
      // Partial event (status change, payment update, cancel/delete) with no amount:
      // update the status only; keep amount, items and time.
      const status = values.status ?? keep.status;
      await tx.update(orders).set({
        status, countsAsRevenue: countsAsRevenue(status), verified: keep.verified || verified,
        sallaId: keep.sallaId ?? n.sallaId, referenceId: keep.referenceId ?? n.referenceId, updatedAt: new Date(),
      }).where(eq(orders.id, keep.id));
      orderId = keep.id;
      action = "updated";
    } else if (n.source === "import" && keep.verified && keep.source !== "import") {
      // A CSV export is less detailed than Salla's own JSON (Make / webhook):
      // only take its status and amount, keep the richer items and ids.
      await tx.update(orders).set({
        status: values.status ?? keep.status, countsAsRevenue: countsAsRevenue(values.status ?? keep.status),
        totalSar: values.totalSar, updatedAt: new Date(),
      }).where(eq(orders.id, keep.id));
      orderId = keep.id;
      action = "skipped";
    } else if (verified || !keep.verified) {
      // Keep the original order time if the new source doesn't know better.
      const orderedAt = n.source === "browser" ? keep.orderedAt : values.orderedAt;
      await tx.update(orders).set({ ...values, orderedAt, orderedDate: riyadhDay(orderedAt) }).where(eq(orders.id, keep.id));
      orderId = keep.id;
      action = "updated";
    } else {
      // Browser report for an order Salla already confirmed: only fill a missing id.
      await tx.update(orders)
        .set({ sallaId: keep.sallaId ?? n.sallaId, referenceId: keep.referenceId ?? n.referenceId })
        .where(eq(orders.id, keep.id));
      orderId = keep.id;
      action = "skipped";
    }

    if (action !== "skipped" && n.items.length > 0) {
      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
      await tx.insert(orderItems).values(n.items.map((i) => ({
        orderId, productId: i.productId, name: i.name, sku: i.sku, quantity: i.quantity, totalSar: i.totalSar.toFixed(2),
      })));
      const known = n.items.filter((i) => i.productId != null);
      if (known.length > 0) {
        await tx.insert(products)
          .values(known.map((i) => ({ id: i.productId!, name: i.name })))
          .onConflictDoUpdate({ target: products.id, set: { name: sql`excluded.name`, updatedAt: new Date() } });
      }
    }

    // Link the purchase report the browser sent (by id or reference). Exactly one
    // attribution per order, otherwise revenue would be counted twice.
    const refs = [n.sallaId, n.referenceId, keep?.sallaId, keep?.referenceId]
      .filter((r) => r != null && r !== "").map(String);
    const [linked] = await tx.select({ ref: attributions.orderRef }).from(attributions)
      .where(eq(attributions.orderId, orderId)).limit(1);
    if (!linked && refs.length > 0) {
      const [candidate] = await tx.select({ ref: attributions.orderRef }).from(attributions)
        .where(and(inArray(attributions.orderRef, refs), isNull(attributions.orderId)))
        .orderBy(attributions.createdAt).limit(1);
      if (candidate) await tx.update(attributions).set({ orderId }).where(eq(attributions.orderRef, candidate.ref));
    }

    return { orderId, action };
  });
}
