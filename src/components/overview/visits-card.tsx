import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { InfoTip } from "@/components/info-tip";
import { Delta } from "@/components/delta";
import { EmptyHint } from "@/components/setup-notice";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rangeLabel } from "@/components/overview/overview-sections";
import type { DateRange } from "@/lib/dates";
import { formatInt, formatPercent, formatSar } from "@/lib/format";
import type { ProductVisits, VisitTotals } from "@/lib/queries/visits";

function Stat({ label, tip, value, delta }: { label: string; tip: string; value: string; delta?: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">{label}<InfoTip>{tip}</InfoTip></div>
      <div className="text-2xl font-semibold tracking-tight tabular">{value}</div>
      {delta}
    </div>
  );
}

export function VisitsCard({
  range, totals, previous, donations, previousDonations, daily, products,
}: {
  range: DateRange; totals: VisitTotals; previous: VisitTotals; donations: number; previousDonations: number;
  daily: Array<{ date: string; sessions: number; visitors: number }>; products: ProductVisits[];
}) {
  const conv = totals.sessions ? donations / totals.sessions : null;
  const prevConv = previous.sessions ? previousDonations / previous.sessions : null;
  return (
    <SectionCard title="الزيارات" description={`${rangeLabel(range)} · من سكربت التتبع في المتجر`}>
      <div className="grid gap-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="الزيارات" tip="عدد الجلسات: كل زيارة للمتجر تُحسب مرة حتى لو تصفح الزائر عدة صفحات."
            value={formatInt(totals.sessions)} delta={<Delta current={totals.sessions} previous={previous.sessions} />} />
          <Stat label="الزوار" tip="عدد المتصفحات المختلفة. الزائر الذي يعود في يوم آخر يُحسب مرة واحدة."
            value={formatInt(totals.visitors)} delta={<Delta current={totals.visitors} previous={previous.visitors} />} />
          <Stat label="مشاهدات الصفحات" tip="كل صفحة فُتحت في المتجر."
            value={formatInt(totals.views)} delta={<Delta current={totals.views} previous={previous.views} />} />
          <Stat label="نسبة التحويل" tip="التبرعات المدفوعة ÷ الزيارات."
            value={conv == null ? "—" : formatPercent(conv)} delta={<Delta current={conv} previous={prevConv} />} />
        </div>
        <TrendChart data={daily} unit="count" height={180}
          series={[{ key: "sessions", label: "الزيارات", color: "var(--chart-1)" }]} />
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">زيارات المشاريع</h3>
            <Link href="/projects" className="text-xs text-primary hover:underline">كل المشاريع</Link>
          </div>
          {products.length === 0 ? <EmptyHint>لا توجد زيارات لصفحات المشاريع في هذه الفترة.</EmptyHint> : (
            <div className="-mx-6">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="ps-6">المشروع</TableHead>
                  <TableHead className="text-end">الزيارات</TableHead>
                  <TableHead className="text-end">التبرعات</TableHead>
                  <TableHead className="text-end">المبلغ</TableHead>
                  <TableHead className="pe-6 text-end">التحويل</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.productId}>
                      <TableCell className="max-w-72 truncate ps-6 font-medium">{p.name}</TableCell>
                      <TableCell className="text-end tabular">{formatInt(p.sessions)}</TableCell>
                      <TableCell className="text-end tabular">{formatInt(p.donations)}</TableCell>
                      <TableCell className="text-end tabular">{formatSar(p.revenue)}</TableCell>
                      <TableCell className="pe-6 text-end tabular">{p.sessions ? formatPercent(p.donations / p.sessions) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
