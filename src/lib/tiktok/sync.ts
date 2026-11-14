import "server-only";
import { addDays, format, parseISO } from "date-fns";
import { riyadhToday } from "@/lib/dates";
import { logRun } from "@/lib/integrations/store";
import { toSar } from "@/lib/orders/normalize-salla";
import { toNumber } from "@/lib/format";
import { replaceApiSpend, upsertAdAccount, upsertEntities, type EntityRow, type SpendRow } from "@/lib/spend/write";
import { TikTokApiError, connection, tiktokConfig, ttGet } from "./client";

/**
 * Pull TikTok spend per ad per day via GET /report/integrated/get/
 * (report_type=BASIC, data_level=AUCTION_AD, dimensions ad_id + stat_time_day).
 * Dates in the report are already in the advertiser's timezone.
 * Campaign/ad group/ad names come back as attribute metrics on the same rows.
 */
const PLATFORM = "tiktok";
const CHUNK_DAYS = 7;
const PAGE_SIZE = 1000;
const BASE_METRICS = ["spend", "impressions", "clicks", "campaign_id", "campaign_name", "adgroup_id", "adgroup_name", "ad_name"];
// Purchase metrics depend on the pixel setup; if TikTok rejects them we retry without.
const PURCHASE_METRICS = ["complete_payment", "total_complete_payment_rate"];

type ReportRow = { dimensions?: Record<string, string>; metrics?: Record<string, string | number> };
type ReportData = { list?: ReportRow[]; page_info?: { page?: number; total_page?: number } };

async function fetchReport(token: string, advertiserId: string, from: string, to: string, metrics: string[]) {
  const rows: ReportRow[] = [];
  for (let page = 1; page <= 50; page++) {
    const data = await ttGet<ReportData>("/report/integrated/get/", token, {
      advertiser_id: advertiserId,
      report_type: "BASIC",
      data_level: "AUCTION_AD",
      dimensions: ["ad_id", "stat_time_day"],
      metrics,
      start_date: from,
      end_date: to,
      page: String(page),
      page_size: String(PAGE_SIZE),
    });
    rows.push(...(data.list ?? []));
    const total = data.page_info?.total_page ?? 1;
    if (page >= total) break;
  }
  return rows;
}

export type SyncResult = { rows: number; from: string; to: string; purchaseMetrics: boolean };

export async function syncTiktok(days = 3): Promise<SyncResult> {
  if (!tiktokConfig()) throw new Error("TikTok is not configured");
  return logRun(PLATFORM, async () => {
    const { token, advertiserId } = await connection();

    const info = await ttGet<{ list?: Array<{ advertiser_id: string; name?: string; currency?: string; timezone?: string; display_timezone?: string }> }>(
      "/advertiser/info/", token, { advertiser_ids: [advertiserId], fields: ["advertiser_id", "name", "currency", "timezone", "display_timezone"] },
    );
    const adv = info.list?.[0];
    const currency = adv?.currency ?? "SAR";
    await upsertAdAccount(PLATFORM, { id: advertiserId, name: adv?.name, currency, timezone: adv?.display_timezone ?? adv?.timezone });

    const to = riyadhToday();
    const from = format(addDays(parseISO(to), -(Math.max(1, days) - 1)), "yyyy-MM-dd");

    let withPurchases = true;
    const report: ReportRow[] = [];
    for (let start = from; start <= to; start = format(addDays(parseISO(start), CHUNK_DAYS), "yyyy-MM-dd")) {
      const chunkEnd = format(addDays(parseISO(start), CHUNK_DAYS - 1), "yyyy-MM-dd");
      const end = chunkEnd > to ? to : chunkEnd;
      try {
        report.push(...(await fetchReport(token, advertiserId, start, end, withPurchases ? [...BASE_METRICS, ...PURCHASE_METRICS] : BASE_METRICS)));
      } catch (e) {
        if (!withPurchases || !(e instanceof TikTokApiError)) throw e;
        withPurchases = false; // most likely an unsupported metric: retry this window without purchase metrics
        report.push(...(await fetchReport(token, advertiserId, start, end, BASE_METRICS)));
      }
    }

    const entities = new Map<string, EntityRow>();
    const rows: SpendRow[] = [];
    for (const r of report) {
      const d = r.dimensions ?? {};
      const m = r.metrics ?? {};
      const adId = String(d.ad_id ?? "");
      const day = String(d.stat_time_day ?? "").slice(0, 10);
      if (!adId || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const campaignId = String(m.campaign_id ?? "");
      const adgroupId = String(m.adgroup_id ?? "");
      if (campaignId) entities.set(`c${campaignId}`, { level: "campaign", externalId: campaignId, parentExternalId: null, name: String(m.campaign_name ?? "") || null, status: null });
      if (adgroupId) entities.set(`g${adgroupId}`, { level: "adset", externalId: adgroupId, parentExternalId: campaignId || null, name: String(m.adgroup_name ?? "") || null, status: null });
      entities.set(`a${adId}`, { level: "ad", externalId: adId, parentExternalId: adgroupId || null, name: String(m.ad_name ?? "") || null, status: null });

      const spend = toNumber(m.spend as string);
      const value = toNumber(m.total_complete_payment_rate as string);
      if (spend === 0 && toNumber(m.impressions as string) === 0) continue;
      rows.push({
        date: day, platform: PLATFORM, accountExternalId: advertiserId,
        campaignId, adsetId: adgroupId, adId,
        spend: spend.toFixed(4), currency, spendSar: toSar(spend, currency).toFixed(2),
        impressions: toNumber(m.impressions as string), clicks: toNumber(m.clicks as string),
        platformConversions: withPurchases ? String(toNumber(m.complete_payment as string)) : null,
        platformConversionValueSar: withPurchases ? toSar(value, currency).toFixed(2) : null,
        source: "api", updatedAt: new Date(),
      });
    }

    await upsertEntities(PLATFORM, advertiserId, [...entities.values()]);
    await replaceApiSpend(PLATFORM, advertiserId, from, to, rows);
    return { rows: rows.length, from, to, purchaseMetrics: withPurchases };
  });
}
