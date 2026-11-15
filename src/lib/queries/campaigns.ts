import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { toNumber } from "@/lib/format";
import type { Filters } from "./filters";

export type CampaignLevel = "campaign" | "ad";

export type CampaignRow = {
  platform: string;
  id: string;
  name: string | null;
  parentName: string | null;
  status: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  platformConversions: number;
  platformValue: number;
  donations: number;
  revenue: number;
};

/**
 * Spend per campaign (or ad) joined to the donations attributed to it. The
 * attribution_resolved view matches the platform's own UTMs by ID or by name.
 * Rows appear if they have spend OR donations in the range.
 */
export async function getCampaignRows(f: Filters, level: CampaignLevel): Promise<CampaignRow[]> {
  const { from, to } = f.range;
  const idCol = level === "campaign" ? sql.raw("campaign_id") : sql.raw("ad_id");
  // Resolved by the attribution_resolved view: ID or name from the platform's own UTMs.
  const utmCol = level === "campaign" ? sql.raw("a.campaign_key") : sql.raw("a.ad_key");
  const ch = f.channel ? sql`and platform = ${f.channel}` : sql``;
  const chA = f.channel ? sql`and a.channel = ${f.channel}` : sql``;

  const rows = await getDb().execute<{
    platform: string; id: string; name: string | null; parent_name: string | null; status: string | null;
    spend: string; impressions: string; clicks: string; conv: string; value: string; donations: string; revenue: string;
  }>(sql`
    with sp as (
      select platform, ${idCol} as id, sum(spend_sar) spend, sum(impressions) impressions, sum(clicks) clicks,
             sum(coalesce(platform_conversions, 0)) conv, sum(coalesce(platform_conversion_value_sar, 0)) value
      from spend_daily
      where date between ${from} and ${to} and ${idCol} <> '' ${ch}
      group by 1, 2
    ), rev as (
      select a.channel as platform, ${utmCol} as id, count(*) donations, sum(o.total_sar) revenue
      from orders o join attribution_resolved a on a.order_id = o.id
      where o.counts_as_revenue and o.ordered_date between ${from} and ${to}
        and ${utmCol} is not null and ${utmCol} <> '' ${chA}
      group by 1, 2
    )
    select coalesce(sp.platform, rev.platform) platform, coalesce(sp.id, rev.id) id,
           e.name, parent.name parent_name, e.status,
           coalesce(sp.spend, 0) spend, coalesce(sp.impressions, 0) impressions, coalesce(sp.clicks, 0) clicks,
           coalesce(sp.conv, 0) conv, coalesce(sp.value, 0) value,
           coalesce(rev.donations, 0) donations, coalesce(rev.revenue, 0) revenue
    from sp full join rev on rev.platform = sp.platform and rev.id = sp.id
    left join ad_entities e on e.platform = coalesce(sp.platform, rev.platform)
      and e.level = ${level} and e.external_id = coalesce(sp.id, rev.id)
    left join ad_entities adset on ${level} = 'ad' and adset.platform = e.platform and adset.level = 'adset' and adset.external_id = e.parent_external_id
    left join ad_entities parent on parent.platform = e.platform and parent.level = 'campaign'
      and parent.external_id = case when ${level} = 'ad' then adset.parent_external_id else null end
    order by coalesce(sp.spend, 0) desc, coalesce(rev.revenue, 0) desc
    limit 500`);

  return rows.map((r) => ({
    platform: r.platform, id: r.id, name: r.name, parentName: r.parent_name, status: r.status,
    spend: toNumber(r.spend), impressions: toNumber(r.impressions), clicks: toNumber(r.clicks),
    platformConversions: toNumber(r.conv), platformValue: toNumber(r.value),
    donations: toNumber(r.donations), revenue: toNumber(r.revenue),
  }));
}
