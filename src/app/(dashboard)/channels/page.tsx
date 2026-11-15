import { Suspense } from "react";
import { connection } from "next/server";
import { PageBody, PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { FilterSkeleton, SectionsSkeleton } from "@/components/page-skeleton";
import { SetupNotice } from "@/components/setup-notice";
import { ChannelTrendsCard } from "@/components/channels/channel-trends";
import { ChannelTableCard } from "@/components/overview/overview-sections";
import { isDatabaseConfigured } from "@/db";
import { parseFilters } from "@/lib/queries/filters";
import { getChannelBreakdown } from "@/lib/queries/overview";
import { getChannelDaily } from "@/lib/queries/channels";


async function Content({ searchParams }: { searchParams: PageProps<"/channels">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const f = parseFilters(sp);
  const [rows, daily] = await Promise.all([getChannelBreakdown(f), getChannelDaily(f)]);
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
      <PageHeader title="القنوات" description="أداء كل منصة: الإنفاق والتبرعات والعائد"
        actions={<Suspense fallback={<FilterSkeleton />}><FilterBar /></Suspense>} />
      <PageBody>
        <Suspense fallback={<SectionsSkeleton />}><Content searchParams={props.searchParams} /></Suspense>
      </PageBody>
    </>
  );
}
