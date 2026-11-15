import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { eachDay, previousRange } from "@/lib/dates";
import { toNumber } from "@/lib/format";
import type { Filters } from "./filters";

/**
 * Store visits come from the storefront tracker (one row per page view).
 * "Visits" = sessions (one browser tab session), "visitors" = distinct browsers.
 * Salla product pages end in /p<product id>, e.g. /ar/سقيا-زمزم/p239598125.
 */
export const PRODUCT_ID_FROM_PATH = sql`nullif(substring(v.path from '/p([0-9]+)/?$'), '')::bigint`;

type Range = { from: string; to: string };

async function visitTotals(r: Range, channel: Filters["channel"]) {
  const ch = channel ? sql`and v.channel = ${channel}` : sql``;
  const [row] = await getDb().execute<{ sessions: string; visitors: string; views: string; product_sessions: string }>(sql`
    select count(distinct v.session_id) sessions, count(distinct v.visitor_id) visitors, count(*) views,
           count(distinct v.session_id) filter (where ${PRODUCT_ID_FROM_PATH} is not null) product_sessions
    from visits v where v.visited_date between ${r.from} and ${r.to} ${ch}`);
  return {
    sessions: toNumber(row?.sessions), visitors: toNumber(row?.visitors),
    views: toNumber(row?.views), productSessions: toNumber(row?.product_sessions),
  };
}
export type VisitTotals = Awaited<ReturnType<typeof visitTotals>>;

export async function getVisitTotals(f: Filters) {
  const [current, previous] = await Promise.all([visitTotals(f.range, f.channel), visitTotals(previousRange(f.range), f.channel)]);
  return { current, previous };
}

export async function getDailyVisits(f: Filters): Promise<Array<{ date: string; sessions: number; visitors: number }>> {
  const ch = f.channel ? sql`and v.channel = ${f.channel}` : sql``;
  const rows = await getDb().execute<{ d: string; sessions: string; visitors: string }>(sql`
    select v.visited_date::text d, count(distinct v.session_id) sessions, count(distinct v.visitor_id) visitors
    from visits v where v.visited_date between ${f.range.from} and ${f.range.to} ${ch} group by 1`);
  const by = new Map(rows.map((r) => [r.d, r]));
  return eachDay(f.range.from, f.range.to).map((d) => ({
    date: d, sessions: toNumber(by.get(d)?.sessions), visitors: toNumber(by.get(d)?.visitors),
  }));
}

export type ProductVisits = { productId: number; name: string; sessions: number; views: number; donations: number; revenue: number };

/** Visits per product page, with the donations that included that product (same filters). */
export async function getProductVisits(f: Filters, limit = 500): Promise<ProductVisits[]> {
  const { from, to } = f.range;
  const chV = f.channel ? sql`and v.channel = ${f.channel}` : sql``;
  const chO = f.channel ? sql`and coalesce(a.channel, 'unknown') = ${f.channel}` : sql``;
  const rows = await getDb().execute<{ pid: string; name: string | null; title: string | null; sessions: string; views: string; donations: string; revenue: string }>(sql`
    with pv as (
      select ${PRODUCT_ID_FROM_PATH} pid, count(distinct v.session_id) sessions, count(*) views,
             (array_agg(v.title order by v.visited_at desc))[1] title
      from visits v where v.visited_date between ${from} and ${to} and ${PRODUCT_ID_FROM_PATH} is not null ${chV}
      group by 1
    ), dn as (
      select m.pid, count(distinct o.id) donations, sum(i.total_sar) revenue
      from order_items i
      -- Same product matching as the projects page: imported lines carry only a name.
      cross join lateral (select coalesce(i.product_id, (select p2.id from products p2 where p2.name = i.name order by p2.id limit 1)) pid) m
      join orders o on o.id = i.order_id left join attributions a on a.order_id = o.id
      where o.counts_as_revenue and o.ordered_date between ${from} and ${to} and m.pid is not null ${chO}
      group by 1
    )
    select pv.pid, p.name, pv.title, pv.sessions, pv.views, coalesce(dn.donations, 0) donations, coalesce(dn.revenue, 0) revenue
    from pv left join dn on dn.pid = pv.pid left join products p on p.id = pv.pid
    order by pv.sessions desc limit ${limit}`);
  return rows.map((r) => ({
    productId: toNumber(r.pid),
    // Page titles look like "سقيا زمزم | متجر إهداء": keep the part before the separator.
    name: r.name ?? r.title?.split(/\s[|–-]\s/)[0]?.trim() ?? `p${r.pid}`,
    sessions: toNumber(r.sessions), views: toNumber(r.views),
    donations: toNumber(r.donations), revenue: toNumber(r.revenue),
  }));
}
