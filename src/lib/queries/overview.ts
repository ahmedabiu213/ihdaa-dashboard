import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { eachDay, previousRange } from "@/lib/dates";
import { toNumber } from "@/lib/format";
import type { Filters } from "./filters";

type Range = { from: string; to: string };

/** SQL fragment: the channel an order is credited to. */
const ORDER_CHANNEL = sql`coalesce(a.channel, 'unknown')`;

async function totals(range: Range, channel: Filters["channel"]) {
  const db = getDb();
  const chOrders = channel ? sql`and ${ORDER_CHANNEL} = ${channel}` : sql``;
  const chSpend = channel ? sql`and platform = ${channel}` : sql``;
  const [rev] = await db.execute<{ revenue: string; donations: string }>(sql`
    select coalesce(sum(o.total_sar), 0) as revenue, count(*) as donations
    from orders o left join attributions a on a.order_id = o.id
    where o.counts_as_revenue and o.ordered_date between ${range.from} and ${range.to} ${chOrders}`);
  const [sp] = await db.execute<{ spend: string; platform_value: string }>(sql`
    select coalesce(sum(spend_sar), 0) as spend, coalesce(sum(platform_conversion_value_sar), 0) as platform_value
    from spend_daily where date between ${range.from} and ${range.to} ${chSpend}`);
  const revenue = toNumber(rev?.revenue);
  const donations = toNumber(rev?.donations);
  const spend = toNumber(sp?.spend);
  return {
    revenue,
    donations,
    spend,
    platformValue: toNumber(sp?.platform_value),
    roas: spend > 0 ? revenue / spend : null,
    costPerDonation: donations > 0 && spend > 0 ? spend / donations : null,
    avgDonation: donations > 0 ? revenue / donations : null,
  };
}

export type Totals = Awaited<ReturnType<typeof totals>>;

export async function getOverviewTotals(f: Filters) {
  const [current, previous] = await Promise.all([totals(f.range, f.channel), totals(previousRange(f.range), f.channel)]);
  return { current, previous };
}

export type DailyPoint = { date: string; revenue: number; spend: number; donations: number };

export async function getDailySeries(f: Filters): Promise<DailyPoint[]> {
  const db = getDb();
  const { from, to } = f.range;
  const chOrders = f.channel ? sql`and ${ORDER_CHANNEL} = ${f.channel}` : sql``;
  const chSpend = f.channel ? sql`and platform = ${f.channel}` : sql``;
  const [rev, sp] = await Promise.all([
    db.execute<{ d: string; revenue: string; donations: string }>(sql`
      select o.ordered_date::text as d, sum(o.total_sar) as revenue, count(*) as donations
      from orders o left join attributions a on a.order_id = o.id
      where o.counts_as_revenue and o.ordered_date between ${from} and ${to} ${chOrders}
      group by 1`),
    db.execute<{ d: string; spend: string }>(sql`
      select date::text as d, sum(spend_sar) as spend from spend_daily
      where date between ${from} and ${to} ${chSpend} group by 1`),
  ]);
  const byDay = new Map<string, DailyPoint>(eachDay(from, to).map((d) => [d, { date: d, revenue: 0, spend: 0, donations: 0 }]));
  for (const r of rev) { const p = byDay.get(r.d); if (p) { p.revenue = toNumber(r.revenue); p.donations = toNumber(r.donations); } }
  for (const r of sp) { const p = byDay.get(r.d); if (p) p.spend = toNumber(r.spend); }
  return [...byDay.values()];
}

export type ChannelRow = {
  channel: string;
  visits: number;
  donations: number;
  revenue: number;
  spend: number;
  platformValue: number;
};

/** Per channel: store-attributed donations, spend, and what the platform itself reports. */
export async function getChannelBreakdown(f: Filters): Promise<ChannelRow[]> {
  const db = getDb();
  const { from, to } = f.range;
  const rows = await db.execute<{
    channel: string; visits: string; donations: string; revenue: string; spend: string; platform_value: string;
  }>(sql`
    with rev as (
      select ${ORDER_CHANNEL} as channel, count(*) as donations, sum(o.total_sar) as revenue
      from orders o left join attributions a on a.order_id = o.id
      where o.counts_as_revenue and o.ordered_date between ${from} and ${to}
      group by 1
    ), sp as (
      select platform as channel, sum(spend_sar) as spend, sum(platform_conversion_value_sar) as platform_value
      from spend_daily where date between ${from} and ${to} group by 1
    ), vis as (
      select channel, count(distinct session_id) as visits
      from visits where visited_date between ${from} and ${to} group by 1
    )
    select coalesce(rev.channel, sp.channel, vis.channel) as channel,
           coalesce(vis.visits, 0) as visits,
           coalesce(rev.donations, 0) as donations, coalesce(rev.revenue, 0) as revenue,
           coalesce(sp.spend, 0) as spend, coalesce(sp.platform_value, 0) as platform_value
    from rev full join sp on sp.channel = rev.channel
    full join vis on vis.channel = coalesce(rev.channel, sp.channel)
    order by coalesce(rev.revenue, 0) desc, coalesce(sp.spend, 0) desc`);
  return rows
    .map((r) => ({
      channel: r.channel,
      visits: toNumber(r.visits),
      donations: toNumber(r.donations),
      revenue: toNumber(r.revenue),
      spend: toNumber(r.spend),
      platformValue: toNumber(r.platform_value),
    }))
    .filter((r) => !f.channel || r.channel === f.channel);
}

export type RecentDonation = {
  id: number; reference: string | null; total: number; orderedAt: string; channel: string;
  campaign: string | null; project: string | null;
};

export async function getRecentDonations(f: Filters, limit = 8): Promise<RecentDonation[]> {
  const db = getDb();
  const ch = f.channel ? sql`and ${ORDER_CHANNEL} = ${f.channel}` : sql``;
  const rows = await db.execute<{
    id: string; reference_id: string | null; total_sar: string; ordered_at: string; channel: string;
    campaign: string | null; project: string | null;
  }>(sql`
    select o.id, o.reference_id, o.total_sar, o.ordered_at, ${ORDER_CHANNEL} as channel,
           coalesce(e.name, a.utm_campaign) as campaign,
           (select string_agg(i.name, '، ') from order_items i where i.order_id = o.id) as project
    from orders o
    left join attributions a on a.order_id = o.id
    left join ad_entities e on e.platform = a.channel and e.level = 'campaign' and e.external_id = a.utm_campaign
    where o.counts_as_revenue and o.ordered_date between ${f.range.from} and ${f.range.to} ${ch}
    order by o.ordered_at desc limit ${limit}`);
  return rows.map((r) => ({
    id: toNumber(r.id), reference: r.reference_id, total: toNumber(r.total_sar),
    orderedAt: new Date(r.ordered_at).toISOString(), channel: r.channel, campaign: r.campaign, project: r.project,
  }));
}
