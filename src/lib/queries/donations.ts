import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { toNumber } from "@/lib/format";
import type { Filters } from "./filters";

export type DonationListFilters = Filters & { q: string | null; status: "all" | "paid" | "unpaid"; verified: "all" | "yes" | "no" };

export type DonationRow = {
  id: number; reference: string | null; sallaId: number | null; orderedAt: string; status: string | null;
  countsAsRevenue: boolean; total: number; source: string; verified: boolean; channel: string;
  campaign: string | null; utmCampaign: string | null; utmTerm: string | null; projects: string | null;
};

function where(f: DonationListFilters): SQL {
  const parts: SQL[] = [sql`o.ordered_date between ${f.range.from} and ${f.range.to}`];
  if (f.channel) parts.push(sql`coalesce(a.channel, 'unknown') = ${f.channel}`);
  if (f.status === "paid") parts.push(sql`o.counts_as_revenue`);
  if (f.status === "unpaid") parts.push(sql`not o.counts_as_revenue`);
  if (f.verified === "yes") parts.push(sql`o.verified`);
  if (f.verified === "no") parts.push(sql`not o.verified`);
  if (f.q) {
    const like = `%${f.q.replace(/[%_]/g, "")}%`;
    parts.push(sql`(o.reference_id ilike ${like} or o.salla_id::text = ${f.q} or exists (select 1 from order_items i where i.order_id = o.id and i.name ilike ${like}))`);
  }
  return sql.join(parts, sql` and `);
}

export async function listDonations(f: DonationListFilters, page: number, pageSize = 50) {
  const db = getDb();
  const w = where(f);
  const [rows, [count]] = await Promise.all([
    db.execute<{
      id: string; reference_id: string | null; salla_id: string | null; ordered_at: string; status: string | null;
      counts_as_revenue: boolean; total_sar: string; source: string; verified: boolean; channel: string;
      campaign: string | null; utm_campaign: string | null; utm_term: string | null; projects: string | null;
    }>(sql`
      select o.id, o.reference_id, o.salla_id, o.ordered_at, o.status, o.counts_as_revenue, o.total_sar, o.source, o.verified,
             coalesce(a.channel, 'unknown') channel, e.name campaign, a.utm_campaign, a.utm_term,
             (select string_agg(i.name, '، ') from order_items i where i.order_id = o.id) projects
      from orders o
      left join attributions a on a.order_id = o.id
      left join ad_entities e on e.platform = a.channel and e.level = 'campaign' and e.external_id = a.utm_campaign
      where ${w}
      order by o.ordered_at desc
      limit ${pageSize} offset ${(page - 1) * pageSize}`),
    db.execute<{ n: string; total: string }>(sql`
      select count(*) n, coalesce(sum(o.total_sar) filter (where o.counts_as_revenue), 0) total
      from orders o left join attributions a on a.order_id = o.id where ${w}`),
  ]);
  return {
    total: toNumber(count?.n),
    revenue: toNumber(count?.total),
    rows: rows.map((r): DonationRow => ({
      id: toNumber(r.id), reference: r.reference_id, sallaId: r.salla_id ? toNumber(r.salla_id) : null,
      orderedAt: new Date(r.ordered_at).toISOString(), status: r.status, countsAsRevenue: r.counts_as_revenue,
      total: toNumber(r.total_sar), source: r.source, verified: r.verified, channel: r.channel,
      campaign: r.campaign, utmCampaign: r.utm_campaign, utmTerm: r.utm_term, projects: r.projects,
    })),
  };
}
