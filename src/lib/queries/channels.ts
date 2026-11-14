import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { eachDay } from "@/lib/dates";
import { toNumber } from "@/lib/format";
import type { Filters } from "./filters";

export type ChannelDaily = { channel: string; points: Array<{ date: string; revenue: number; spend: number }> };

/** Daily store-attributed revenue and spend for each channel that has either. */
export async function getChannelDaily(f: Filters): Promise<ChannelDaily[]> {
  const { from, to } = f.range;
  const ch = f.channel ? sql`where channel = ${f.channel}` : sql``;
  const rows = await getDb().execute<{ channel: string; d: string; revenue: string; spend: string }>(sql`
    with rev as (
      select coalesce(a.channel, 'unknown') channel, o.ordered_date d, sum(o.total_sar) revenue
      from orders o left join attributions a on a.order_id = o.id
      where o.counts_as_revenue and o.ordered_date between ${from} and ${to} group by 1, 2
    ), sp as (
      select platform channel, date d, sum(spend_sar) spend from spend_daily
      where date between ${from} and ${to} group by 1, 2
    ), j as (
      select coalesce(rev.channel, sp.channel) channel, coalesce(rev.d, sp.d)::text d,
             coalesce(rev.revenue, 0) revenue, coalesce(sp.spend, 0) spend
      from rev full join sp on sp.channel = rev.channel and sp.d = rev.d
    )
    select * from j ${ch}`);
  const days = eachDay(from, to);
  const by = new Map<string, Map<string, { revenue: number; spend: number }>>();
  for (const r of rows) {
    const m = by.get(r.channel) ?? new Map();
    m.set(r.d, { revenue: toNumber(r.revenue), spend: toNumber(r.spend) });
    by.set(r.channel, m);
  }
  return [...by]
    .map(([channel, m]) => ({ channel, points: days.map((d) => ({ date: d, revenue: m.get(d)?.revenue ?? 0, spend: m.get(d)?.spend ?? 0 })) }))
    .sort((a, b) => sum(b) - sum(a));
}
const sum = (c: ChannelDaily) => c.points.reduce((s, p) => s + p.revenue + p.spend, 0);
