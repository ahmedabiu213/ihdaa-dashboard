import { Suspense } from "react";
import { connection } from "next/server";
import { PageBody, PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { FilterSkeleton, SectionsSkeleton } from "@/components/page-skeleton";
import { SectionCard } from "@/components/section-card";
import { EmptyHint, SetupNotice } from "@/components/setup-notice";
import { ChannelName } from "@/components/channel-dot";
import { TrendChart } from "@/components/charts/trend-chart";
import { ChannelTableCard, rangeLabel } from "@/components/overview/overview-sections";
import { isDatabaseConfigured } from "@/db";
import { formatRatio, formatSar } from "@/lib/format";
import { parseFilters } from "@/lib/queries/filters";
import { getChannelBreakdown } from "@/lib/queries/overview";
import { getChannelDaily } from "@/lib/queries/channels";

const SERIES = [
  { key: "revenue", label: "التبرعات", color: "var(--chart-1)" },
  { key: "spend", label: "الإنفاق", color: "var(--chart-2)" },
];

async function Content({ searchParams }: { searchParams: PageProps<"/channels">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const f = parseFilters(sp);
  const [rows, daily] = await Promise.all([getChannelBreakdown(f), getChannelDaily(f)]);
  return (
    <>
      <ChannelTableCard rows={rows} />
      <SectionCard
        title="الاتجاه اليومي لكل قناة"
        description={`${rangeLabel(f.range)} · التبرعات المنسوبة مقابل الإنفاق، بالريال`}
        action={
          <div className="flex items-center gap-4 text-sm">
            {SERIES.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-full border-2" style={{ borderColor: s.color }} />{s.label}
              </span>
            ))}
          </div>
        }
      >
        {daily.length === 0 ? <EmptyHint>لا توجد بيانات في هذه الفترة.</EmptyHint> : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {daily.map((c) => {
              const rev = c.points.reduce((s, p) => s + p.revenue, 0);
              const spend = c.points.reduce((s, p) => s + p.spend, 0);
              return (
                <div key={c.channel} className="grid gap-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium"><ChannelName channel={c.channel} /></span>
                    <span className="text-sm font-semibold tabular">{spend > 0 ? formatRatio(rev / spend) : "—"}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground tabular">
                    <span>تبرعات {formatSar(rev)}</span><span>إنفاق {formatSar(spend)}</span>
                  </div>
                  <TrendChart data={c.points} series={SERIES} height={110} />
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
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
