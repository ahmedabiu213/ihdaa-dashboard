import { Suspense } from "react";
import { connection } from "next/server";
import { PageBody, PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { FilterSkeleton, SectionsSkeleton } from "@/components/page-skeleton";
import { SetupNotice } from "@/components/setup-notice";
import {
  ChannelTableCard, OverviewCard, RecentDonationsCard, RevenueVsSpendCard,
} from "@/components/overview/overview-sections";
import { isDatabaseConfigured } from "@/db";
import { parseFilters } from "@/lib/queries/filters";
import { getChannelBreakdown, getDailySeries, getOverviewTotals, getRecentDonations } from "@/lib/queries/overview";
import { getChannelDaily } from "@/lib/queries/channels";
import { ChannelTrendsCard } from "@/components/channels/channel-trends";

async function Overview({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  // Always render per request: "today" in Riyadh and the data are never baked in at build.
  await connection();
  const filters = parseFilters(await searchParams);
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const [{ current, previous }, daily, channels, channelDaily, recent] = await Promise.all([
    getOverviewTotals(filters),
    getDailySeries(filters),
    getChannelBreakdown(filters),
    getChannelDaily(filters),
    getRecentDonations(filters),
  ]);
  return (
    <>
      <OverviewCard range={filters.range} totals={current} previous={previous} daily={daily} />
      <RevenueVsSpendCard daily={daily} />
      <ChannelTableCard rows={channels} />
      <ChannelTrendsCard range={filters.range} daily={channelDaily} />
      <RecentDonationsCard rows={recent} />
    </>
  );
}

export default function OverviewPage(props: PageProps<"/">) {
  return (
    <>
      <PageHeader
        title="نظرة عامة"
        description="التبرعات والإنفاق والعائد لكل القنوات"
        actions={<Suspense fallback={<FilterSkeleton />}><FilterBar /></Suspense>}
      />
      <PageBody>
        <Suspense fallback={<SectionsSkeleton />}>
          <Overview searchParams={props.searchParams} />
        </Suspense>
      </PageBody>
    </>
  );
}
