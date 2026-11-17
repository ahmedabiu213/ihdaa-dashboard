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
import { canSeeSpend } from "@/lib/roles";
import { getCurrentUser } from "@/lib/supabase/server";
import { redactChannelDaily, redactChannels, redactDaily, redactTotals } from "@/lib/queries/redact";
import { parseFilters } from "@/lib/queries/filters";
import { getChannelBreakdown, getDailySeries, getOverviewTotals, getRecentDonations } from "@/lib/queries/overview";
import { getChannelDaily } from "@/lib/queries/channels";
import { ChannelTrendsCard } from "@/components/channels/channel-trends";
import { VisitsCard } from "@/components/overview/visits-card";
import { getDailyVisits, getProductVisits, getVisitTotals } from "@/lib/queries/visits";

async function Overview({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  // Always render per request: "today" in Riyadh and the data are never baked in at build.
  await connection();
  const filters = parseFilters(await searchParams);
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const [user, { current, previous }, daily, channels, channelDaily, recent, visits, dailyVisits, productVisits] = await Promise.all([
    getCurrentUser(),
    getOverviewTotals(filters),
    getDailySeries(filters),
    getChannelBreakdown(filters),
    getChannelDaily(filters),
    getRecentDonations(filters),
    getVisitTotals(filters),
    getDailyVisits(filters),
    getProductVisits(filters, 8),
  ]);
  if (!user || !canSeeSpend(user.role)) {
    // Donations-only view: spend never leaves the server.
    return (
      <>
        <OverviewCard range={filters.range} totals={redactTotals(current)} previous={redactTotals(previous)} daily={redactDaily(daily)} showSpend={false} />
        <VisitsCard
          range={filters.range} totals={visits.current} previous={visits.previous}
          donations={current.donations} previousDonations={previous.donations}
          daily={dailyVisits} products={productVisits}
        />
        <ChannelTableCard rows={redactChannels(channels)} showSpend={false} />
        <ChannelTrendsCard range={filters.range} daily={redactChannelDaily(channelDaily)} showSpend={false} />
        <RecentDonationsCard rows={recent} />
      </>
    );
  }
  return (
    <>
      <OverviewCard range={filters.range} totals={current} previous={previous} daily={daily} />
      <RevenueVsSpendCard daily={daily} />
      <VisitsCard
        range={filters.range} totals={visits.current} previous={visits.previous}
        donations={current.donations} previousDonations={previous.donations}
        daily={dailyVisits} products={productVisits}
      />
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
        description="ملخص التبرعات والقنوات للفترة المختارة"
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
