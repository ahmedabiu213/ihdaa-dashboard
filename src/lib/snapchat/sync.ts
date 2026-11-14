import "server-only";
import { TZDate } from "@date-fns/tz";
import { addDays, format, parseISO } from "date-fns";
import { riyadhToday } from "@/lib/dates";
import { logRun } from "@/lib/integrations/store";
import { toSar } from "@/lib/orders/normalize-salla";
import { replaceApiSpend, upsertAdAccount, upsertEntities, type EntityRow } from "@/lib/spend/write";
import { snapchatConfig, snapGet, snapList } from "./client";

/**
 * Pull Snapchat spend per ad per day into spend_daily.
 *
 * Per Snap's measurement docs:
 * - GET /v1/adaccounts/{id}/stats?granularity=DAY&breakdown=ad
 * - DAY start/end must sit on the ad account's day boundaries (its timezone)
 * - spend and *_value fields are micro-currency (÷ 1,000,000)
 * - large synchronous responses are rejected (E9001), so we request a week at a time
 */
const PLATFORM = "snapchat";
const FIELDS = "impressions,swipes,spend,conversion_purchases,conversion_purchases_value";
const CHUNK_DAYS = 7;
const MICRO = 1_000_000;

type SnapAccount = { id: string; name: string; currency: string; timezone: string };
type SnapEntity = { id: string; name: string; status: string; campaign_id?: string; ad_squad_id?: string };
type SnapStats = { impressions?: number; swipes?: number; spend?: number; conversion_purchases?: number; conversion_purchases_value?: number };
type StatsResponse = {
  paging?: { next_link?: string };
  timeseries_stats?: Array<{
    timeseries_stat?: {
      breakdown_stats?: {
        ad?: Array<{ id: string; timeseries?: Array<{ start_time: string; stats: SnapStats }> }>;
      };
    };
  }>;
};

/** "2026-11-01" at midnight in `tz`, as ISO with offset. */
function dayStart(day: string, tz: string) {
  const d = parseISO(day);
  return format(new TZDate(d.getFullYear(), d.getMonth(), d.getDate(), tz), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
}

/** The account-local calendar day a bucket starting at `iso` belongs to. */
function bucketDay(iso: string, tz: string) {
  // +1h guards against buckets that start slightly before local midnight (DST edges).
  return format(new TZDate(new Date(iso).getTime() + 3600_000, tz), "yyyy-MM-dd");
}

async function syncEntities(accountId: string) {
  const [campaigns, squads, ads] = await Promise.all([
    snapList<SnapEntity>(`/adaccounts/${accountId}/campaigns`, "campaigns", "campaign"),
    snapList<SnapEntity>(`/adaccounts/${accountId}/adsquads`, "adsquads", "adsquad"),
    snapList<SnapEntity>(`/adaccounts/${accountId}/ads`, "ads", "ad"),
  ]);
  const rows: EntityRow[] = [
    ...campaigns.map((c) => ({ level: "campaign" as const, externalId: c.id, parentExternalId: null, name: c.name, status: c.status })),
    ...squads.map((q) => ({ level: "adset" as const, externalId: q.id, parentExternalId: q.campaign_id ?? null, name: q.name, status: q.status })),
    ...ads.map((a) => ({ level: "ad" as const, externalId: a.id, parentExternalId: a.ad_squad_id ?? null, name: a.name, status: a.status })),
  ];
  await upsertEntities(PLATFORM, accountId, rows);
  // ad → { adset, campaign }
  const squadCampaign = new Map(squads.map((s) => [s.id, s.campaign_id ?? ""]));
  return new Map(ads.map((a) => [a.id, { adsetId: a.ad_squad_id ?? "", campaignId: squadCampaign.get(a.ad_squad_id ?? "") ?? "" }]));
}

async function fetchStats(accountId: string, from: string, toExclusive: string, tz: string) {
  const out: Array<{ adId: string; day: string; stats: SnapStats }> = [];
  let next: string | null = null;
  let first = true;
  for (let page = 0; (first || next) && page < 50; page++) {
    const body: StatsResponse = first
      ? await snapGet<StatsResponse>(`/adaccounts/${accountId}/stats`, {
          granularity: "DAY", breakdown: "ad", fields: FIELDS, omit_empty: "true", limit: "200",
          start_time: dayStart(from, tz), end_time: dayStart(toExclusive, tz),
        })
      : await snapGet<StatsResponse>(next!);
    first = false;
    for (const ts of body.timeseries_stats ?? []) {
      for (const ad of ts.timeseries_stat?.breakdown_stats?.ad ?? []) {
        for (const bucket of ad.timeseries ?? []) out.push({ adId: ad.id, day: bucketDay(bucket.start_time, tz), stats: bucket.stats });
      }
    }
    next = body.paging?.next_link ?? null;
  }
  return out;
}

export type SyncResult = { rows: number; from: string; to: string };

/** Sync the last `days` days (including today). Replaces API rows for that window, so corrections stick. */
export async function syncSnapchat(days = 3): Promise<SyncResult> {
  const cfg = snapchatConfig();
  if (!cfg) throw new Error("Snapchat is not configured");
  return logRun(PLATFORM, async () => {
    const { adaccounts } = await snapGet<{ adaccounts: Array<{ adaccount: SnapAccount }> }>(`/adaccounts/${cfg.adAccountId}`);
    const account = adaccounts?.[0]?.adaccount;
    if (!account) throw new Error("Snapchat ad account not found or not accessible");

    await upsertAdAccount(PLATFORM, account);

    const adMap = await syncEntities(account.id);

    const to = riyadhToday();
    const from = format(addDays(parseISO(to), -(Math.max(1, days) - 1)), "yyyy-MM-dd");
    const buckets: Awaited<ReturnType<typeof fetchStats>> = [];
    for (let start = from; start <= to; start = format(addDays(parseISO(start), CHUNK_DAYS), "yyyy-MM-dd")) {
      const endExclusive = format(addDays(parseISO(start), CHUNK_DAYS), "yyyy-MM-dd");
      const capped = endExclusive > format(addDays(parseISO(to), 1), "yyyy-MM-dd") ? format(addDays(parseISO(to), 1), "yyyy-MM-dd") : endExclusive;
      buckets.push(...(await fetchStats(account.id, start, capped, account.timezone)));
    }

    const rows = buckets.map(({ adId, day, stats }) => {
      const parents = adMap.get(adId) ?? { adsetId: "", campaignId: "" };
      const spend = (stats.spend ?? 0) / MICRO;
      const value = (stats.conversion_purchases_value ?? 0) / MICRO;
      return {
        date: day, platform: PLATFORM, accountExternalId: account.id,
        campaignId: parents.campaignId, adsetId: parents.adsetId, adId,
        spend: spend.toFixed(4), currency: account.currency, spendSar: toSar(spend, account.currency).toFixed(2),
        impressions: stats.impressions ?? 0, clicks: stats.swipes ?? 0,
        platformConversions: String(stats.conversion_purchases ?? 0),
        platformConversionValueSar: toSar(value, account.currency).toFixed(2),
        source: "api", updatedAt: new Date(),
      };
    });

    await replaceApiSpend(PLATFORM, account.id, from, to, rows);
    return { rows: rows.length, from, to };
  });
}
