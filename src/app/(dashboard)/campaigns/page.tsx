import { Suspense } from "react";
import { connection } from "next/server";
import { PageBody, PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { LevelTabs } from "@/components/level-tabs";
import { FilterSkeleton, SectionsSkeleton } from "@/components/page-skeleton";
import { SectionCard } from "@/components/section-card";
import { EmptyHint, SetupNotice } from "@/components/setup-notice";
import { ChannelName } from "@/components/channel-dot";
import { InfoTip } from "@/components/info-tip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isDatabaseConfigured } from "@/db";
import { formatInt, formatRatio, formatSar } from "@/lib/format";
import { parseFilters } from "@/lib/queries/filters";
import { getCampaignRows, type CampaignLevel } from "@/lib/queries/campaigns";
import { rangeLabel } from "@/components/overview/overview-sections";

const LEVELS = [
  { value: "campaign", label: "الحملات" },
  { value: "ad", label: "الإعلانات" },
];

async function Content({ searchParams }: { searchParams: PageProps<"/campaigns">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <SetupNotice />;
  const filters = parseFilters(sp);
  const level: CampaignLevel = sp.level === "ad" ? "ad" : "campaign";
  const rows = await getCampaignRows(filters, level);
  const label = level === "campaign" ? "الحملة" : "الإعلان";

  return (
    <SectionCard
      title={level === "campaign" ? "أداء الحملات" : "أداء الإعلانات"}
      description={`${rangeLabel(filters.range)} · التبرعات منسوبة عبر معرّف ${label} في رابط UTM`}
      contentClassName="px-0"
    >
      {rows.length === 0 ? (
        <EmptyHint>لا يوجد إنفاق أو تبرعات منسوبة في هذه الفترة. اربط سناب شات من صفحة الربط والمزامنة.</EmptyHint>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-6">{label}</TableHead>
              <TableHead>المنصة</TableHead>
              <TableHead className="text-end">الإنفاق</TableHead>
              <TableHead className="text-end">الظهور</TableHead>
              <TableHead className="text-end">النقرات</TableHead>
              <TableHead className="text-end">التبرعات</TableHead>
              <TableHead className="text-end">المبلغ</TableHead>
              <TableHead className="text-end">تكلفة التبرع</TableHead>
              <TableHead className="text-end">العائد</TableHead>
              <TableHead className="pe-6 text-end">
                <span className="inline-flex items-center gap-1">
                  حسب المنصة
                  <InfoTip>قيمة المشتريات كما يذكرها البكسل في المنصة. للمقارنة فقط.</InfoTip>
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.platform}-${r.id}`}>
                <TableCell className="max-w-72 ps-6">
                  <div className="truncate font-medium">{r.name ?? <span dir="ltr" className="font-mono text-xs">{r.id}</span>}</div>
                  {r.parentName && <div className="truncate text-xs text-muted-foreground">{r.parentName}</div>}
                </TableCell>
                <TableCell><ChannelName channel={r.platform} /></TableCell>
                <TableCell className="text-end tabular">{formatSar(r.spend)}</TableCell>
                <TableCell className="text-end tabular">{formatInt(r.impressions)}</TableCell>
                <TableCell className="text-end tabular">{formatInt(r.clicks)}</TableCell>
                <TableCell className="text-end tabular">{formatInt(r.donations)}</TableCell>
                <TableCell className="text-end tabular">{formatSar(r.revenue)}</TableCell>
                <TableCell className="text-end tabular">{r.donations && r.spend ? formatSar(r.spend / r.donations, true) : "—"}</TableCell>
                <TableCell className="text-end font-medium tabular">{r.spend ? formatRatio(r.revenue / r.spend) : "—"}</TableCell>
                <TableCell className="pe-6 text-end text-muted-foreground tabular">{r.platformValue ? formatSar(r.platformValue) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}

export default function CampaignsPage(props: PageProps<"/campaigns">) {
  return (
    <>
      <PageHeader
        title="الحملات"
        description="الإنفاق والتبرعات لكل حملة وإعلان"
        actions={
          <Suspense fallback={<FilterSkeleton />}>
            <LevelTabs options={LEVELS} />
            <FilterBar />
          </Suspense>
        }
      />
      <PageBody>
        <Suspense fallback={<SectionsSkeleton />}>
          <Content searchParams={props.searchParams} />
        </Suspense>
      </PageBody>
    </>
  );
}
