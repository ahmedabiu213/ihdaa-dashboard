import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { toNumber } from "@/lib/format";
import type { Filters } from "./filters";

export type ProjectRow = {
  key: string; productId: number | null; name: string; donations: number; revenue: number;
  byChannel: Array<{ channel: string; revenue: number }>;
};

/**
 * Donations per project (Salla product) from order lines, split by the channel
 * the order is attributed to. Lines without a product id are grouped by name.
 */
export async function getProjects(f: Filters): Promise<ProjectRow[]> {
  const { from, to } = f.range;
  const ch = f.channel ? sql`and coalesce(a.channel, 'unknown') = ${f.channel}` : sql``;
  const rows = await getDb().execute<{ key: string; product_id: string | null; name: string; channel: string; donations: string; revenue: string }>(sql`
    select coalesce(pid::text, 'n:' || i.name) key, pid product_id, coalesce(p.name, i.name) name,
           coalesce(a.channel, 'unknown') channel, count(distinct o.id) donations, sum(i.total_sar) revenue
    from order_items i
    -- Lines from a CSV import have no product id: match them to a known product by name.
    cross join lateral (select coalesce(i.product_id, (select p2.id from products p2 where p2.name = i.name order by p2.id limit 1)) pid) m
    join orders o on o.id = i.order_id
    left join attributions a on a.order_id = o.id
    left join products p on p.id = pid
    where o.counts_as_revenue and o.ordered_date between ${from} and ${to} ${ch}
    group by 1, 2, 3, 4`);
  const by = new Map<string, ProjectRow>();
  for (const r of rows) {
    const p = by.get(r.key) ?? { key: r.key, productId: r.product_id ? toNumber(r.product_id) : null, name: r.name, donations: 0, revenue: 0, byChannel: [] };
    p.donations += toNumber(r.donations);
    p.revenue += toNumber(r.revenue);
    p.byChannel.push({ channel: r.channel, revenue: toNumber(r.revenue) });
    by.set(r.key, p);
  }
  for (const p of by.values()) p.byChannel.sort((a, b) => b.revenue - a.revenue);
  return [...by.values()].sort((a, b) => b.revenue - a.revenue);
}
