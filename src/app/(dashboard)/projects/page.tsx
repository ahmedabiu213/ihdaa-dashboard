import { Suspense } from "react";
import { connection } from "next/server";
import { PageBody, PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { FilterSkeleton, SectionsSkeleton } from "@/components/page-skeleton";
import { SectionCard } from "@/components/section-card";
import { EmptyHint, SetupNotice } from "@/components/setup-notice";
import { ChannelName } from "@/components/channel-dot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { rangeLabel } from "@/components/overview/overview-sections";
import { isDatabaseConfigured } from "@/db";
import { CHANNELS, channelLabel, isChannel } from "@/lib/channels";
import { formatInt, formatPercent, formatSar } from "@/lib/format";
import { parseFilters } from "@/lib/queries/filters";
import { getProjects } from "@/lib/queries/projects";

const color = (c: string) => (isChannel(c) ? CHANNELS[c].color : CHANNELS.other.color);

async function Content({ searchParams }: { searchParams: PageProps<"/projects">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const f = parseFilters(sp);
  const rows = await getProjects(f);
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  const channelsShown = [...new Set(rows.flatMap((r) => r.byChannel.map((c) => c.channel)))];

  return (
    <SectionCard
      title="التبرعات لكل مشروع"
      description={`${rangeLabel(f.range)} · من بنود الطلبات المدفوعة، موزعة على القناة التي جاء منها المتبرع`}
      contentClassName="px-0"
    >
      {rows.length === 0 ? <EmptyHint>لا توجد تبرعات في هذه الفترة.</EmptyHint> : (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-6 pb-3 text-xs text-muted-foreground">
            {channelsShown.map((c) => <ChannelName key={c} channel={c} />)}
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="ps-6">المشروع</TableHead>
              <TableHead className="text-end">التبرعات</TableHead>
              <TableHead className="text-end">المبلغ</TableHead>
              <TableHead className="text-end">متوسط التبرع</TableHead>
              <TableHead className="text-end">الحصة</TableHead>
              <TableHead className="w-72 pe-6">حسب القناة</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="max-w-72 ps-6">
                    <div className="truncate font-medium">{r.name}</div>
                    {r.productId && <div className="text-xs text-muted-foreground" dir="ltr">p-{r.productId}</div>}
                  </TableCell>
                  <TableCell className="text-end tabular">{formatInt(r.donations)}</TableCell>
                  <TableCell className="text-end font-medium tabular">{formatSar(r.revenue)}</TableCell>
                  <TableCell className="text-end tabular">{r.donations ? formatSar(r.revenue / r.donations) : "—"}</TableCell>
                  <TableCell className="text-end tabular text-muted-foreground">{total ? formatPercent(r.revenue / total) : "—"}</TableCell>
                  <TableCell className="pe-6">
                    <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
                      {r.byChannel.filter((c) => c.revenue > 0).map((c) => (
                        <Tooltip key={c.channel}>
                          <TooltipTrigger asChild>
                            <div className="h-full first:rounded-s-full last:rounded-e-full" style={{ width: `${(c.revenue / r.revenue) * 100}%`, background: color(c.channel) }} />
                          </TooltipTrigger>
                          <TooltipContent>{channelLabel(c.channel)}: {formatSar(c.revenue)} ({formatPercent(c.revenue / r.revenue)})</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </SectionCard>
  );
}

export default function ProjectsPage(props: PageProps<"/projects">) {
  return (
    <>
      <PageHeader title="المشاريع" description="التبرعات لكل مشروع ومن أي قناة جاءت"
        actions={<Suspense fallback={<FilterSkeleton />}><FilterBar /></Suspense>} />
      <PageBody>
        <Suspense fallback={<SectionsSkeleton />}><Content searchParams={props.searchParams} /></Suspense>
      </PageBody>
    </>
  );
}
