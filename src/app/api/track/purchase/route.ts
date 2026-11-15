import { sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { resolveChannel } from "@/lib/channels";
import { json } from "@/lib/http";
import { upsertOrder } from "@/lib/orders/upsert";
import { toSar } from "@/lib/orders/normalize-salla";
import { corsHeaders, ownHost, readTracked } from "@/lib/tracking/request";
import { purchaseSchema } from "@/lib/tracking/schemas";

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: { ...corsHeaders(req), "Access-Control-Allow-Headers": "content-type" } });
}

/**
 * Purchase report from the storefront script.
 * 1. Saves the attribution (where the donor came from). First report per order wins.
 * 2. If it carries an amount, records an UNVERIFIED order so donations show up
 *    even before/without Salla's own data. Salla data later overwrites it.
 */
export async function POST(req: Request) {
  const headers = corsHeaders(req);
  const r = await readTracked(req, purchaseSchema);
  if ("error" in r) return json({ error: r.error }, 400, headers);
  const p = r.data;
  const t = p.touch ?? {};

  await getDb().insert(schema.attributions).values({
    orderRef: p.order_ref,
    visitorId: p.vid,
    sessionId: p.sid,
    channel: resolveChannel({ utmSource: t.utm_source, clickIdType: t.click_type, referrer: t.referrer, ownHost: ownHost() }),
    utmSource: t.utm_source, utmMedium: t.utm_medium, utmCampaign: t.utm_campaign,
    utmContent: t.utm_content, utmTerm: t.utm_term, utmId: t.utm_id,
    clickIdType: t.click_type ?? null, clickId: t.click_id,
    landingPath: t.landing,
    touchedAt: t.ts ? new Date(t.ts) : null,
  }).onConflictDoNothing();

  const sallaId = p.order_id ?? null;
  const referenceId = p.reference_id ?? (p.order_id ? null : p.order_ref);
  if (p.total && p.total > 0) {
    const currency = (p.currency ?? "SAR").toUpperCase();
    await upsertOrder({
      sallaId,
      referenceId,
      status: null,
      totalSar: toSar(p.total, currency),
      currency,
      paymentMethod: null,
      orderedAt: new Date(),
      items: (p.items ?? []).map((i) => {
        const qty = i.quantity ?? 1;
        return { productId: i.product_id ?? null, name: i.name ?? "تبرع", sku: null, quantity: qty, totalSar: toSar((i.price ?? 0) * qty, currency) };
      }),
      source: "browser",
      raw: p,
    });
  } else {
    // No amount: still try to link to an order Salla already sent.
    await upsertLinkOnly(p.order_ref, p.order_id ?? null, referenceId);
  }
  return json({ ok: true }, 200, headers);
}

async function upsertLinkOnly(orderRef: string, sallaId: number | null, referenceId: string | null) {
  await getDb().execute(sql`
    update attributions a set order_id = o.id
    from orders o
    where a.order_ref = ${orderRef} and a.order_id is null
      and (o.salla_id = ${sallaId} or o.reference_id = ${referenceId} or o.reference_id = ${orderRef})
      and not exists (select 1 from attributions x where x.order_id = o.id)`);
}
