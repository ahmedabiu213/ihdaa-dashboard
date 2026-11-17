import { Suspense } from "react";
import { connection } from "next/server";
import { PageBody, PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { FilterSkeleton, SectionsSkeleton } from "@/components/page-skeleton";
import { SetupNotice } from "@/components/setup-notice";
import { ChannelTrendsCard } from "@/components/channels/channel-trends";
import { ChannelTableCard } from "@/components/overview/overview-sections";
import { isDatabaseConfigured } from "@/db";
import { canSeeSpend } from "@/lib/roles";
import { getCurrentUser } from "@/lib/supabase/server";
import { redactChannelDaily, redactChannels } from "@/lib/queries/redact";
import { parseFilters } from "@/lib/queries/filters";
import { getChannelBreakdown } from "@/lib/queries/overview";
import { getChannelDaily } from "@/lib/queries/channels";


async function Content({ searchParams }: { searchParams: PageProps<"/channels">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const f = parseFilters(sp);
  const [user, rows, daily] = await Promise.all([getCurrentUser(), getChannelBreakdown(f), getChannelDaily(f)]);
  if (!user || !canSeeSpend(user.role)) {
    return (
      <>
        <ChannelTableCard rows={redactChannels(rows)} showSpend={false} />
        <ChannelTrendsCard range={f.range} daily={redactChannelDaily(daily)} showSpend={false} />
      </>
    );
  }
  return (
    <>
      <ChannelTableCard rows={rows} />
      <ChannelTrendsCard range={f.range} daily={daily} />
    </>
  );
}

export default function ChannelsPage(props: PageProps<"/channels">) {
  return (
    <>
      <PageHeader title="القنوات" description="أداء كل قناة: الزيارات والتبرعات والمبالغ"
        actions={<Suspense fallback={<FilterSkeleton />}><FilterBar /></Suspense>} />
      <PageBody>
        <Suspense fallback={<SectionsSkeleton />}><Content searchParams={props.searchParams} /></Suspense>
      </PageBody>
    </>
  );
}
