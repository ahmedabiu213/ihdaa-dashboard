import { SectionCard } from "@/components/section-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { InfoTip } from "@/components/info-tip";
import { Delta } from "@/components/delta";
import { ChannelName } from "@/components/channel-dot";
import { EmptyHint } from "@/components/setup-notice";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RANGE_PRESETS, formatDateTime, type DateRange } from "@/lib/dates";
import { formatInt, formatPercent, formatRatio, formatSar } from "@/lib/format";
import type { ChannelRow, DailyPoint, RecentDonation, Totals } from "@/lib/queries/overview";

const REVENUE_COLOR = "var(--chart-1)";
const SPEND_COLOR = "var(--chart-2)";

export function rangeLabel(r: DateRange) {
  return r.preset === "custom" ? `${r.from} — ${r.to}` : RANGE_PRESETS[r.preset];
}

function Metric({
  label, tip, value, delta, children,
}: { label: string; tip: string; value: string; delta: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-1">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {label}
        <InfoTip>{tip}</InfoTip>
      </div>
      <div className="text-2xl font-semibold tracking-tight tabular">{value}</div>
      {delta}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

export function OverviewCard({
  range, totals, previous, daily,
}: { range: DateRange; totals: Totals; previous: Totals; daily: DailyPoint[] }) {
  return (
    <SectionCard
      title="نظرة عامة"
      action={<span className="text-sm text-muted-foreground">{rangeLabel(range)}</span>}
    >
      <div className="grid gap-8 md:grid-cols-3">
        <Metric
          label="إجمالي التبرعات"
          tip="مجموع الطلبات المدفوعة في سلة خلال الفترة. هذا هو الرقم الحقيقي من المتجر وليس من المنصات."
          value={formatSar(totals.revenue)}
          delta={<Delta current={totals.revenue} previous={previous.revenue} />}
        >
          <TrendChart data={daily} series={[{ key: "revenue", label: "التبرعات", color: REVENUE_COLOR }]} />
        </Metric>
        <Metric
          label="الإنفاق الإعلاني"
          tip="مجموع الإنفاق من كل المنصات المربوطة أو المُدخلة يدويًا، محوّلًا إلى الريال."
          value={formatSar(totals.spend)}
          delta={<Delta current={totals.spend} previous={previous.spend} goodWhen="neutral" />}
        >
          <TrendChart data={daily} series={[{ key: "spend", label: "الإنفاق", color: SPEND_COLOR }]} />
        </Metric>
        <Metric
          label="عدد التبرعات"
          tip="عدد الطلبات المدفوعة. التبرع الواحد قد يحتوي أكثر من مشروع."
          value={formatInt(totals.donations)}
          delta={<Delta current={totals.donations} previous={previous.donations} />}
        >
          <TrendChart data={daily} unit="count" series={[{ key: "donations", label: "عدد التبرعات", color: REVENUE_COLOR }]} />
        </Metric>
      </div>
      <div className="mt-6 grid gap-6 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="العائد على الإنفاق"
          tip="إجمالي التبرعات ÷ الإنفاق الإعلاني. يشمل كل التبرعات حتى غير المنسوبة لإعلان، لذلك هو المؤشر الأشمل."
          value={formatRatio(totals.roas)}
          delta={<Delta current={totals.roas} previous={previous.roas} />}
        />
        <Metric
          label="تكلفة التبرع"
          tip="الإنفاق الإعلاني ÷ عدد التبرعات."
          value={totals.costPerDonation == null ? "—" : formatSar(totals.costPerDonation, true)}
          delta={<Delta current={totals.costPerDonation} previous={previous.costPerDonation} goodWhen="down" />}
        />
        <Metric
          label="متوسط التبرع"
          tip="إجمالي التبرعات ÷ عدد التبرعات."
          value={totals.avgDonation == null ? "—" : formatSar(totals.avgDonation, true)}
          delta={<Delta current={totals.avgDonation} previous={previous.avgDonation} />}
        />
        <Metric
          label="ما تنسبه المنصات لنفسها"
          tip="قيمة التحويلات كما تذكرها المنصات الإعلانية. عادةً أعلى من الحقيقة لأن كل منصة تنسب التبرع نفسه لنفسها."
          value={formatSar(totals.platformValue)}
          delta={<Delta current={totals.platformValue} previous={previous.platformValue} goodWhen="neutral" />}
        />
      </div>
    </SectionCard>
  );
}

export function RevenueVsSpendCard({ daily }: { daily: DailyPoint[] }) {
  const series = [
    { key: "revenue", label: "التبرعات", color: REVENUE_COLOR },
    { key: "spend", label: "الإنفاق", color: SPEND_COLOR },
  ];
  return (
    <SectionCard
      title="التبرعات مقابل الإنفاق"
      description="يوميًا بتوقيت الرياض، بالريال"
      action={
        <div className="flex items-center gap-4 text-sm">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2.5 rounded-full border-2" style={{ borderColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      }
    >
      <TrendChart data={daily} series={series} height={260} />
    </SectionCard>
  );
}

export function ChannelTableCard({ rows }: { rows: ChannelRow[] }) {
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  return (
    <SectionCard
      title="أداء القنوات"
      description="التبرعات منسوبة من روابط UTM ومعرّفات النقر؛ الإنفاق من المنصات"
      contentClassName="px-0"
    >
      {rows.length === 0 ? (
        <EmptyHint>لا توجد زيارات أو تبرعات أو إنفاق في هذه الفترة.</EmptyHint>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-6">القناة</TableHead>
              <TableHead className="text-end">الزيارات</TableHead>
              <TableHead className="text-end">التبرعات</TableHead>
              <TableHead className="text-end">المبلغ</TableHead>
              <TableHead className="text-end">الإنفاق</TableHead>
              <TableHead className="text-end">العائد</TableHead>
              <TableHead className="text-end">حسب المنصة</TableHead>
              <TableHead className="w-40 pe-6">الحصة من التبرعات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const share = totalRevenue > 0 ? r.revenue / totalRevenue : 0;
              return (
                <TableRow key={r.channel}>
                  <TableCell className="ps-6 font-medium"><ChannelName channel={r.channel} /></TableCell>
                  <TableCell className="text-end tabular">{formatInt(r.visits)}</TableCell>
                  <TableCell className="text-end tabular">{formatInt(r.donations)}</TableCell>
                  <TableCell className="text-end tabular">{formatSar(r.revenue)}</TableCell>
                  <TableCell className="text-end tabular">{r.spend ? formatSar(r.spend) : "—"}</TableCell>
                  <TableCell className="text-end tabular">{r.spend ? formatRatio(r.revenue / r.spend) : "—"}</TableCell>
                  <TableCell className="text-end tabular text-muted-foreground">
                    {r.platformValue ? formatSar(r.platformValue) : "—"}
                  </TableCell>
                  <TableCell className="pe-6">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${share * 100}%` }} />
                      </div>
                      <span className="w-10 text-end text-xs tabular text-muted-foreground">{formatPercent(share)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}

export function RecentDonationsCard({ rows }: { rows: RecentDonation[] }) {
  return (
    <SectionCard title="أحدث التبرعات" description="آخر التبرعات المدفوعة ومصدرها" contentClassName="px-0">
      {rows.length === 0 ? (
        <EmptyHint>لم تصل تبرعات في هذه الفترة بعد.</EmptyHint>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-6">رقم الطلب</TableHead>
              <TableHead>المشروع</TableHead>
              <TableHead>القناة</TableHead>
              <TableHead>الحملة</TableHead>
              <TableHead className="text-end">المبلغ</TableHead>
              <TableHead className="pe-6 text-end">الوقت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="ps-6 tabular" dir="ltr">{r.reference ?? r.id}</TableCell>
                <TableCell className="max-w-56 truncate">{r.project ?? "—"}</TableCell>
                <TableCell><ChannelName channel={r.channel} /></TableCell>
                <TableCell className="max-w-40 truncate text-muted-foreground">{r.campaign ?? "—"}</TableCell>
                <TableCell className="text-end font-medium tabular">{formatSar(r.total)}</TableCell>
                <TableCell className="pe-6 text-end text-muted-foreground tabular">{formatDateTime(r.orderedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}
