import { normalizeSallaOrder } from "./normalize-salla";
import { countsAsRevenue } from "./types";

// Shape copied from a real order in this store's Salla orders list (customer removed).
const real = {
  id: 1838741064, reference_id: 289223917, total: { amount: 25, currency: "SAR" },
  date: { date: "2026-09-27 05:52:28.000000", timezone_type: 3, timezone: "Asia/Riyadh" },
  source: "store", status: { id: 1298199463, name: "تم التنفيذ", slug: "completed", customized: { id: 1737801119, name: "تم التنفيذ" } },
  payment_method: "apple_pay",
  items: [{ name: "إفطار صائم شهر رمضان للمعتمرين", quantity: 1 }, { name: "سقيا الماء للمعتمرين", quantity: 1 }],
};
let failed = 0;
const check = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failed++; console.error("FAIL", name, got); } else console.log("ok  ", name); };
for (const body of [real, { event: "order.created", data: real }]) {
  const n = normalizeSallaOrder(body, "make");
  check("ids", n.sallaId === 1838741064 && n.referenceId === "289223917", [n.sallaId, n.referenceId]);
  check("total", n.totalSar === 25, n.totalSar);
  check("status", n.status === "completed" && countsAsRevenue(n.status), n.status);
  check("time (Riyadh → UTC)", n.orderedAt.toISOString() === "2026-09-27T02:52:28.000Z", n.orderedAt.toISOString());
  check("items split", n.items.length === 2 && n.items[0].totalSar + n.items[1].totalSar === 25, n.items.map((i) => i.totalSar));
}
check("deleted not counted", !countsAsRevenue("deleted"));
check("quote not counted", !countsAsRevenue("request_quote"));
process.exit(failed ? 1 : 0);
