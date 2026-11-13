"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCompact, formatInt, formatSar } from "@/lib/format";
import { formatDay } from "@/lib/dates";

export type TrendSeries = { key: string; label: string; color: string };

/**
 * Line + soft area over time. One y-axis only: every series must share the
 * same unit (e.g. revenue and spend are both SAR).
 */
export function TrendChart({
  data, series, unit = "sar", height = 120, showGrid = true,
}: {
  data: Array<Record<string, number | string>>;
  series: TrendSeries[];
  unit?: "sar" | "count";
  height?: number;
  showGrid?: boolean;
}) {
  const config = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig;
  const fmt = unit === "sar" ? (v: number) => formatSar(v) : (v: number) => formatInt(v);
  const last = data.length - 1;

  return (
    // Recharts lays out in LTR; time reads left→right like the platforms' own charts.
    <div dir="ltr">
      <ChartContainer config={config} className="w-full" style={{ height }}>
        <AreaChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`var(--color-${s.key})`} stopOpacity={0.18} />
                <stop offset="100%" stopColor={`var(--color-${s.key})`} stopOpacity={0.01} />
              </linearGradient>
            ))}
          </defs>
          {showGrid && <CartesianGrid vertical horizontal={false} stroke="var(--chart-grid)" />}
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            minTickGap={28}
            tickFormatter={(d: string) => formatDay(d)}
            className="text-[10px]"
          />
          <YAxis
            orientation="right"
            width={52}
            tickLine={false}
            axisLine={false}
            tickCount={4}
            allowDecimals={false}
            tickFormatter={(v: number) => formatCompact(v)}
            className="text-[10px]"
          />
          <ChartTooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, p) => formatDay(String(p?.[0]?.payload?.date ?? ""))}
                formatter={(value, name, item) => (
                  <div className="flex w-full items-center justify-between gap-4" dir="rtl">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="size-2 rounded-full" style={{ background: item.color }} />
                      {config[String(name)]?.label}
                    </span>
                    <span className="font-medium tabular">{fmt(Number(value))}</span>
                  </div>
                )}
              />
            }
          />
          {series.map((s) => (
            <Area
              key={s.key}
              dataKey={s.key}
              type="monotone"
              stroke={`var(--color-${s.key})`}
              strokeWidth={2}
              fill={`url(#fill-${s.key})`}
              isAnimationActive={false}
              dot={(p: { index?: number; cx?: number; cy?: number }) =>
                p.index === last && p.cx != null && p.cy != null ? (
                  <circle key={`dot-${s.key}`} cx={p.cx} cy={p.cy} r={4} fill={`var(--color-${s.key})`} stroke="var(--card)" strokeWidth={2} />
                ) : (
                  <g key={`dot-${s.key}-${p.index}`} />
                )
              }
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
