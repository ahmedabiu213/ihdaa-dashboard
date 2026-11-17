import { toNumber } from "@/lib/format";
import type { NormalizedItem, NormalizedOrder, OrderSource } from "./types";

/**
 * Turn a Salla order object into our shape. The same order JSON arrives from
 * Make.com's Salla trigger, a Partners-app webhook, or the Salla API, so one
 * tolerant parser serves all of them. Accepts the webhook envelope
 * `{ event, data: {...order} }` or the bare order.
 *
 * Field names follow Salla's order resource; unknown shapes fall back safely
 * and the raw body is always stored for re-processing.
 */
type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const str = (v: unknown): string | null => (v == null || v === "" ? null : String(v));

/** Salla money is either a number, a string, or `{ amount, currency }`. */
function money(v: unknown): { amount: number; currency: string | null } {
  if (v && typeof v === "object") {
    const o = v as Json;
    return { amount: toNumber(o.amount as string), currency: str(o.currency) };
  }
  return { amount: toNumber(v as string), currency: null };
}

export function toSar(amount: number, currency: string | null) {
  const c = (currency ?? "SAR").toUpperCase();
  if (c === "SAR") return amount;
  if (c === "USD") return amount * toNumber(process.env.USD_TO_SAR ?? "3.75");
  return amount; // unknown currency: keep as is, `currency` column records it
}

function parseSallaDate(v: unknown): Date | null {
  // Salla dates look like { date: "2025-01-31 18:20:00.000000", timezone: "Asia/Riyadh" } or an ISO string.
  const o = obj(v);
  const raw = str(o.date) ?? str(v);
  if (!raw) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) return new Date(raw);
  // Plain date (invoices): noon Riyadh, so it lands on the right day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T12:00:00+03:00`);
  // Other textual dates, e.g. "Tue Nov 17 2026 00:15:51 GMT+0300".
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d/.test(raw)) { const d = new Date(raw); return Number.isNaN(d.getTime()) ? null : d; }
  const tz = str(o.timezone) ?? "Asia/Riyadh";
  const base = raw.replace(" ", "T").replace(/(\.\d{3})\d+$/, "$1");
  // Only Riyadh is expected; it has no DST, so a fixed offset is exact.
  return new Date(tz === "Asia/Riyadh" ? `${base}+03:00` : `${base}Z`);
}

export function normalizeSallaOrder(body: unknown, source: OrderSource): NormalizedOrder {
  const envelope = obj(body);
  let order = envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)
    ? obj(envelope.data)
    : envelope;
  // Some events wrap the order: { data: { order: {...}, status: ... } }.
  if (order.order && typeof order.order === "object" && !Array.isArray(order.order)) {
    const inner = obj(order.order);
    order = { ...inner, status: inner.status ?? order.status };
  }
  // Partial events carry the order id as order_id.
  if (order.id == null && order.order_id != null) order = { ...order, id: order.order_id };

  const amounts = obj(order.amounts);
  const total = money(amounts.total ?? order.total);
  const currency = (total.currency ?? str(order.currency) ?? "SAR").toUpperCase();

  const statusObj = obj(order.status);
  const status = str(statusObj.slug) ?? str(statusObj.name) ?? str(order.status);

  const items: NormalizedItem[] = (Array.isArray(order.items) ? order.items : []).map((raw) => {
    const it = obj(raw);
    const qty = Math.max(1, Math.round(toNumber(it.quantity as string)) || 1);
    const itemAmounts = obj(it.amounts);
    const lineTotal = money(itemAmounts.total ?? it.total).amount
      || money(itemAmounts.price_without_tax ?? it.price).amount * qty;
    const product = obj(it.product);
    return {
      productId: toNumber((product.id ?? it.product_id) as string) || null,
      name: str(it.name) ?? str(product.name) ?? "تبرع",
      sku: str(it.sku) ?? str(product.sku),
      quantity: qty,
      totalSar: toSar(lineTotal, currency),
    };
  });

  // Salla's order list sends items without amounts: split the total by quantity.
  const orderTotalSar = toSar(total.amount, currency);
  if (items.length > 0 && orderTotalSar > 0 && items.every((i) => i.totalSar === 0)) {
    const qty = items.reduce((n, i) => n + i.quantity, 0);
    let left = orderTotalSar;
    items.forEach((i, idx) => {
      i.totalSar = idx === items.length - 1 ? Math.round(left * 100) / 100 : Math.round((orderTotalSar * i.quantity / qty) * 100) / 100;
      left -= i.totalSar;
    });
  }

  const paymentMethod = str(order.payment_method) ?? str(obj(order.payment_method).name);

  return {
    sallaId: toNumber(order.id as string) || null,
    referenceId: str(order.reference_id),
    status: status?.toLowerCase() ?? null,
    totalSar: toSar(total.amount || items.reduce((s, i) => s + i.totalSar, 0), currency),
    currency,
    paymentMethod,
    orderedAt: parseSallaDate(order.date) ?? parseSallaDate(order.created_at) ?? parseSallaDate(envelope.created_at) ?? new Date(),
    items,
    source,
    raw: body,
    hasAmount: (total.amount || 0) > 0 || items.some((i) => i.totalSar > 0),
  };
}
