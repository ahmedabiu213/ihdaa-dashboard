import { z } from "zod";
import { hasSecret, json } from "@/lib/http";
import { saveIntegration } from "@/lib/integrations/store";
import { toSar } from "@/lib/orders/normalize-salla";
import { replaceApiSpend, upsertAdAccount, upsertEntities } from "@/lib/spend/write";

/**
 * Receives daily campaign spend pushed by the Google Ads Script (lib/google/script.ts).
 * Auth: `Authorization: Bearer $GOOGLE_ADS_INGEST_SECRET`.
 * Each push replaces the script's rows for that account and date window.
 */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const num = z.coerce.number().finite();
const body = z.object({
  account: z.object({ id: z.string().min(1).max(40), name: z.string().max(200).optional(), currency: z.string().max(8), timezone: z.string().max(60).optional() }),
  from: day,
  to: day,
  rows: z.array(z.object({
    date: day, campaign_id: z.coerce.string().max(40), campaign_name: z.string().max(300).optional(),
    cost_micros: num, impressions: num.optional(), clicks: num.optional(), conversions: num.optional(), conversions_value: num.optional(),
  })).max(20000),
});

export async function POST(req: Request) {
  if (!hasSecret(req, process.env.GOOGLE_ADS_INGEST_SECRET)) return json({ error: "unauthorized" }, 401);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid body", issues: parsed.error.issues.slice(0, 5) }, 400);
  const { account, from, to, rows } = parsed.data;
  const accountId = account.id.replace(/-/g, "");
  const currency = account.currency.toUpperCase();

  await upsertAdAccount("google", { id: accountId, name: account.name, currency, timezone: account.timezone });
  const campaigns = new Map(rows.map((r) => [r.campaign_id, r.campaign_name ?? null]));
  await upsertEntities("google", accountId, [...campaigns].map(([id, name]) => ({ level: "campaign", externalId: id, parentExternalId: null, name, status: null })));

  const spendRows = rows.filter((r) => r.cost_micros > 0 || (r.impressions ?? 0) > 0).map((r) => {
    const spend = r.cost_micros / 1_000_000;
    return {
      date: r.date, platform: "google", accountExternalId: accountId, campaignId: r.campaign_id, adsetId: "", adId: "",
      spend: spend.toFixed(4), currency, spendSar: toSar(spend, currency).toFixed(2),
      impressions: Math.round(r.impressions ?? 0), clicks: Math.round(r.clicks ?? 0),
      platformConversions: r.conversions != null ? r.conversions.toFixed(2) : null,
      platformConversionValueSar: r.conversions_value != null ? toSar(r.conversions_value, currency).toFixed(2) : null,
      source: "script", updatedAt: new Date(),
    };
  });
  await replaceApiSpend("google", accountId, from, to, spendRows, "script");
  await saveIntegration("google", { status: "connected", lastSyncAt: new Date(), lastError: null, meta: { accountId, currency } });
  return json({ ok: true, rows: spendRows.length });
}
