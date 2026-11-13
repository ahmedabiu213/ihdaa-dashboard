import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";

/** Change vs the previous period. `goodWhen` decides green/red; "neutral" stays gray. */
export function Delta({
  current, previous, goodWhen = "up",
}: { current: number | null; previous: number | null; goodWhen?: "up" | "down" | "neutral" }) {
  if (current == null || previous == null || previous === 0) {
    return <span className="text-xs text-muted-foreground">لا توجد فترة سابقة للمقارنة</span>;
  }
  const change = (current - previous) / Math.abs(previous);
  const up = change >= 0;
  const good = goodWhen === "neutral" ? null : (goodWhen === "up") === up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular",
        good == null ? "text-muted-foreground" : good ? "text-success" : "text-destructive",
      )}
    >
      <Icon className="size-3.5" />
      {formatPercent(Math.abs(change))}
      <span className="font-normal text-muted-foreground">&nbsp;عن الفترة السابقة</span>
    </span>
  );
}
