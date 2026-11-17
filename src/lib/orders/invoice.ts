/**
 * Salla store webhooks (Pro plan) expose orders only through «انشاء فاتورة طلب»
 * (invoice.created). Its data is an invoice, shaped like this (from this store's API):
 *   { id: <invoice id>, invoice_number, order_id: <Salla internal order id>, invoice_reference_id,
 *     type: "فاتورة ضريبية", date: "2026-11-16", payment_method, total: { amount, currency },
 *     items: [{ product_id, name, quantity, total: { amount } }] }
 * It has no order number (reference_id) and only a date, so the time comes from the event.
 */
type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});

export function isCreditNote(inv: Json) {
  const type = String(inv.type ?? "");
  return (inv.invoice_reference_id != null && inv.invoice_reference_id !== "") || /دائن|credit/i.test(type);
}

/** Turn an invoice.created envelope into an order-shaped object the order parser understands. */
export function invoiceToOrder(envelope: unknown): { order: Json; creditNote: boolean } {
  const env = obj(envelope);
  const inv = obj(env.data);
  const creditNote = isCreditNote(inv);
  const order: Json = {
    id: inv.order_id,
    total: inv.total,
    currency: obj(inv.total).currency ?? inv.store_currency,
    payment_method: inv.payment_method,
    // The event time is precise; the invoice only has a date.
    date: env.created_at ?? inv.date,
    status: creditNote ? "restored" : null,
    items: Array.isArray(inv.items)
      ? (inv.items as unknown[]).map((raw) => {
          const it = obj(raw);
          return { name: it.name, sku: it.sku, quantity: it.quantity, product_id: it.product_id, total: it.total, price: it.price };
        })
      : [],
    invoice: { id: inv.id, number: inv.invoice_number },
  };
  return { order, creditNote };
}
