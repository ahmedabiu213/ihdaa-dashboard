import "server-only";
import { upsertOrder } from "@/lib/orders/upsert";
import type { NormalizedItem, NormalizedOrder } from "@/lib/orders/types";
import { toSar } from "@/lib/orders/normalize-salla";
import { parseAmount, parseCsv, parseDay, pickHeader } from "./csv";

/**
 * Import Salla's order export (saved as CSV UTF-8). The export's exact columns
 * vary with the store's settings, so columns are matched by common Arabic and
 * English names, and rows sharing one order number are merged into one order
 * (some exports list one row per product).
 */
const ALIASES = {
  reference: ["رقم الطلب", "Order Number", "Order ID", "order_id", "reference_id", "رقم المرجع", "#"],
  date: ["تاريخ الطلب", "التاريخ", "Order Date", "Date", "created_at"],
  status: ["حالة الطلب", "الحالة", "Order Status", "Status"],
  total: ["إجمالي الطلب", "الإجمالي", "المجموع", "قيمة الطلب", "Order Total", "Total", "Grand Total", "amount"],
  currency: ["العملة", "Currency"],
  payment: ["طريقة الدفع", "Payment Method", "payment_method"],
  product: ["اسم المنتج", "المنتج", "المنتجات", "Product", "Product Name", "Products", "Item"],
  productId: ["رقم المنتج", "معرف المنتج", "Product ID", "product_id", "SKU ID"],
  quantity: ["الكمية", "Quantity", "Qty"],
  itemTotal: ["سعر المنتج", "إجمالي المنتج", "Item Total", "Product Total", "Price"],
};

/** Salla's Arabic/English status names → status slugs used by countsAsRevenue(). */
const STATUS_MAP: Array<[RegExp, string]> = [
  [/بانتظار الدفع|awaiting payment|payment.?pending|pending payment/i, "payment_pending"],
  [/ملغ|cancel/i, "canceled"],
  [/مسترجع|استرجاع|restor|refund/i, "restored"],
  [/بانتظار المراجعة|under.?review/i, "under_review"],
  [/قيد التنفيذ|in.?progress|processing/i, "in_progress"],
  [/تم التوصيل|delivered/i, "delivered"],
  [/جاري التوصيل|delivering/i, "delivering"],
  [/تم الشحن|shipped/i, "shipped"],
  [/مكتمل|تم التنفيذ|complet/i, "completed"],
];

function statusSlug(v: string | undefined) {
  if (!v?.trim()) return null;
  for (const [re, slug] of STATUS_MAP) if (re.test(v)) return slug;
  return v.trim().toLowerCase();
}

function parseDateTime(v: string | undefined): Date | null {
  const day = parseDay(v);
  if (!day) return null;
  const t = String(v).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|ص|م)?/i);
  let h = t ? Number(t[1]) : 12;
  const min = t ? Number(t[2]) : 0;
  const ampm = t?.[4]?.toLowerCase();
  if ((ampm === "pm" || ampm === "م") && h < 12) h += 12;
  if ((ampm === "am" || ampm === "ص") && h === 12) h = 0;
  // Salla exports in store time (Riyadh, UTC+3, no DST).
  return new Date(`${day}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00+03:00`);
}

export type OrdersImportResult = { created: number; updated: number; skipped: Array<{ line: number; reason: string }>; headers: string[] };

export async function importSallaOrdersCsv(text: string): Promise<OrdersImportResult> {
  const { headers, rows } = parseCsv(text);
  const h = Object.fromEntries(Object.entries(ALIASES).map(([k, a]) => [k, pickHeader(headers, a)])) as Record<keyof typeof ALIASES, string | null>;
  const result: OrdersImportResult = { created: 0, updated: 0, skipped: [], headers };
  if (!h.reference || !h.total || !h.date) {
    result.skipped.push({ line: 1, reason: `لم أجد أعمدة رقم الطلب والإجمالي والتاريخ. الأعمدة الموجودة: ${headers.join("، ") || "لا شيء"}` });
    return result;
  }

  const groups = new Map<string, { line: number; rows: Record<string, string>[] }>();
  rows.forEach((r, i) => {
    const ref = String(r[h.reference!] ?? "").replace(/^#/, "").trim();
    if (!ref) return void result.skipped.push({ line: i + 2, reason: "بدون رقم طلب" });
    const g = groups.get(ref) ?? { line: i + 2, rows: [] };
    g.rows.push(r);
    groups.set(ref, g);
  });

  for (const [ref, g] of groups) {
    const first = g.rows[0];
    const orderedAt = parseDateTime(first[h.date!]);
    const total = parseAmount(first[h.total!]);
    if (!orderedAt) { result.skipped.push({ line: g.line, reason: "تاريخ غير صالح" }); continue; }
    if (total == null) { result.skipped.push({ line: g.line, reason: "إجمالي غير صالح" }); continue; }
    const currency = (h.currency ? first[h.currency] : "")?.trim().toUpperCase() || "SAR";
    const items: NormalizedItem[] = h.product
      ? g.rows.filter((r) => r[h.product!]?.trim()).map((r) => {
          const qty = Math.max(1, Math.round(parseAmount(h.quantity ? r[h.quantity] : "1") ?? 1));
          const line = h.itemTotal ? parseAmount(r[h.itemTotal]) : null;
          return {
            productId: h.productId ? Math.round(parseAmount(r[h.productId]) ?? 0) || null : null,
            name: r[h.product!].trim().slice(0, 300),
            sku: null,
            quantity: qty,
            totalSar: toSar(line ?? (g.rows.length === 1 ? total : 0), currency),
          };
        })
      : [];
    // No per-product amounts in the export: split the order total across lines by quantity.
    if (items.length > 0 && items.every((i) => i.totalSar === 0)) {
      const qty = items.reduce((n, i) => n + i.quantity, 0);
      const sar = toSar(total, currency);
      let left = sar;
      items.forEach((i, idx) => {
        i.totalSar = idx === items.length - 1 ? Math.round(left * 100) / 100 : Math.round((sar * i.quantity / qty) * 100) / 100;
        left -= i.totalSar;
      });
    }
    const order: NormalizedOrder = {
      sallaId: null, referenceId: ref, status: statusSlug(h.status ? first[h.status] : undefined),
      totalSar: toSar(total, currency), currency, paymentMethod: h.payment ? first[h.payment]?.trim() || null : null,
      orderedAt, items, source: "import", raw: { importedRow: first },
    };
    try {
      const r = await upsertOrder(order);
      if (r.action === "created") result.created++; else result.updated++;
    } catch (e) {
      result.skipped.push({ line: g.line, reason: e instanceof Error ? e.message.slice(0, 120) : "خطأ" });
    }
  }
  return result;
}
