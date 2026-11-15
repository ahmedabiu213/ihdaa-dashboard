import { SectionCard } from "@/components/section-card";
import { EmptyHint } from "@/components/setup-notice";
import { ChannelName } from "@/components/channel-dot";
import { TrendChart } from "@/components/charts/trend-chart";
import { rangeLabel } from "@/components/overview/overview-sections";
import type { DateRange } from "@/lib/dates";
import { formatRatio, formatSar } from "@/lib/format";
import type { ChannelDaily } from "@/lib/queries/channels";

const SERIES = [
  { key: "revenue", label: "التبرعات", color: "var(--chart-1)" },
  { key: "spend", label: "الإنفاق", color: "var(--chart-2)" },
];

/** One small donations-vs-spend chart per channel (same SAR scale within each card). */
export function ChannelTrendsCard({ range, daily }: { range: DateRange; daily: ChannelDaily[] }) {
  return (
    <SectionCard
      title="الاتجاه اليومي لكل قناة"
      description={`${rangeLabel(range)} · التبرعات المنسوبة مقابل الإنفاق، بالريال`}
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
  );
}
