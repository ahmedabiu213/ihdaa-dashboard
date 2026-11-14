import "server-only";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { SPEND_PLATFORMS, resolveChannel } from "@/lib/channels";
import { toSar } from "@/lib/orders/normalize-salla";
import { toCode } from "@/lib/utm";
import { parseAmount, parseCsv, parseDay, pickHeader } from "./csv";

/**
 * Manual and CSV spend live beside API spend in spend_daily, under their own
 * account id ("manual" / "csv"), so an API re-sync never deletes them.
 * Re-entering the same platform + day + campaign replaces the amount.
 */
export type ManualSource = "manual" | "csv";
export type SpendInput = {
  date: string; platform: string; spend: number; currency: string;
  campaign?: string | null; impressions?: number | null; clicks?: number | null; note?: string | null;
};

export function normalizePlatform(v: string): string | null {
  const ch = resolveChannel({ utmSource: v });
  return (SPEND_PLATFORMS as readonly string[]).includes(ch) ? ch : null;
}

export async function upsertManualSpend(rows: SpendInput[], source: ManualSource) {
  if (rows.length === 0) return 0;
  const values = rows.map((r) => {
    const currency = (r.currency || "SAR").toUpperCase();
    return {
      date: r.date, platform: r.platform, accountExternalId: source, campaignId: r.campaign ? toCode(r.campaign) : "",
      adsetId: "", adId: "", spend: r.spend.toFixed(4), currency, spendSar: toSar(r.spend, currency).toFixed(2),
      impressions: Math.round(r.impressions ?? 0), clicks: Math.round(r.clicks ?? 0),
      source, note: r.note?.slice(0, 300) || null, updatedAt: new Date(),
    };
  });
  // Merge duplicates inside one upload (same grain) by summing, so the upsert doesn't hit the same row twice.
  const merged = new Map<string, (typeof values)[number]>();
  for (const v of values) {
    const k = `${v.platform}|${v.date}|${v.campaignId}`;
    const prev = merged.get(k);
    if (!prev) { merged.set(k, v); continue; }
    prev.spend = (Number(prev.spend) + Number(v.spend)).toFixed(4);
    prev.spendSar = (Number(prev.spendSar) + Number(v.spendSar)).toFixed(2);
    prev.impressions += v.impressions;
    prev.clicks += v.clicks;
  }
  const list = [...merged.values()];
  for (let i = 0; i < list.length; i += 500) {
    await getDb().insert(schema.spendDaily).values(list.slice(i, i + 500)).onConflictDoUpdate({
      target: [schema.spendDaily.platform, schema.spendDaily.date, schema.spendDaily.accountExternalId,
        schema.spendDaily.campaignId, schema.spendDaily.adsetId, schema.spendDaily.adId],
      set: {
        spend: sql`excluded.spend`, currency: sql`excluded.currency`, spendSar: sql`excluded.spend_sar`,
        impressions: sql`excluded.impressions`, clicks: sql`excluded.clicks`, note: sql`excluded.note`,
        source: sql`excluded.source`, updatedAt: new Date(),
      },
    });
  }
  return list.length;
}

export const SPEND_CSV_TEMPLATE =
  "date,platform,spend,currency,campaign,impressions,clicks\n" +
  "2026-11-14,meta,250.50,SAR,ramadan-1,12000,340\n" +
  "2026-11-14,google,120,USD,,4000,90\n";

const ALIASES = {
  date: ["date", "day", "التاريخ", "اليوم", "Reporting starts", "Day", "Date"],
  platform: ["platform", "channel", "source", "المنصة", "القناة"],
  spend: ["spend", "cost", "amount", "amount spent", "Amount spent (SAR)", "Amount spent (USD)", "الإنفاق", "المبلغ", "التكلفة"],
  currency: ["currency", "العملة"],
  campaign: ["campaign", "campaign name", "الحملة", "اسم الحملة"],
  impressions: ["impressions", "impr", "الظهور", "مرات الظهور"],
  clicks: ["clicks", "link clicks", "النقرات"],
};

export type ImportReport = { imported: number; skipped: Array<{ line: number; reason: string }>; headers: string[] };

/** `defaultPlatform` applies when the file has no platform column (e.g. a Meta Ads Manager export). */
export function parseSpendCsv(text: string, defaultPlatform: string | null): { rows: SpendInput[]; report: ImportReport } {
  const { headers, rows } = parseCsv(text);
  const h = Object.fromEntries(Object.entries(ALIASES).map(([k, a]) => [k, pickHeader(headers, a)])) as Record<keyof typeof ALIASES, string | null>;
  const report: ImportReport = { imported: 0, skipped: [], headers };
  if (!h.date || !h.spend) {
    report.skipped.push({ line: 1, reason: `لم أجد عمود التاريخ أو الإنفاق. الأعمدة الموجودة: ${headers.join("، ") || "لا شيء"}` });
    return { rows: [], report };
  }
  // A currency hinted in the spend header, e.g. "Amount spent (USD)".
  const headerCurrency = h.spend.match(/\b(SAR|USD|AED|EUR)\b/i)?.[1]?.toUpperCase() ?? null;
  const out: SpendInput[] = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    const date = parseDay(r[h.date!]);
    const spend = parseAmount(r[h.spend!]);
    const platform = h.platform ? normalizePlatform(r[h.platform] ?? "") : defaultPlatform;
    if (!date) return report.skipped.push({ line, reason: "تاريخ غير صالح" });
    if (spend == null) return report.skipped.push({ line, reason: "مبلغ غير صالح" });
    if (!platform) return report.skipped.push({ line, reason: "منصة غير معروفة" });
    if (spend === 0) return;
    out.push({
      date, platform, spend,
      currency: (h.currency ? r[h.currency] : null)?.trim().toUpperCase() || headerCurrency || "SAR",
      campaign: h.campaign ? r[h.campaign] : null,
      impressions: h.impressions ? parseAmount(r[h.impressions]) : null,
      clicks: h.clicks ? parseAmount(r[h.clicks]) : null,
    });
  });
  return { rows: out, report };
}
