import { TZDate } from "@date-fns/tz";
import { addDays, differenceInCalendarDays, format, parseISO, startOfMonth, subMonths, endOfMonth } from "date-fns";

export const TZ = "Asia/Riyadh";

/** Today's date in Riyadh as YYYY-MM-DD. */
export function riyadhToday(): string {
  return format(TZDate.tz(TZ), "yyyy-MM-dd");
}

/** Riyadh calendar day (YYYY-MM-DD) of an instant. */
export function riyadhDay(d: Date | string | number): string {
  return format(new TZDate(new Date(d), TZ), "yyyy-MM-dd");
}

export const RANGE_PRESETS = {
  today: "اليوم",
  yesterday: "أمس",
  "7d": "آخر 7 أيام",
  "28d": "آخر 28 يوم",
  "90d": "آخر 90 يوم",
  month: "هذا الشهر",
  "last-month": "الشهر الماضي",
} as const;
export type RangePreset = keyof typeof RANGE_PRESETS;
export const DEFAULT_PRESET: RangePreset = "28d";

export type DateRange = { from: string; to: string; preset: RangePreset | "custom" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function resolveRange(params: { range?: string; from?: string; to?: string }): DateRange {
  const today = parseISO(riyadhToday());
  if (params.from && params.to && ISO.test(params.from) && ISO.test(params.to)) {
    const [from, to] = params.from <= params.to ? [params.from, params.to] : [params.to, params.from];
    return { from, to, preset: "custom" };
  }
  const preset = (params.range && params.range in RANGE_PRESETS ? params.range : DEFAULT_PRESET) as RangePreset;
  switch (preset) {
    case "today": return { from: iso(today), to: iso(today), preset };
    case "yesterday": { const y = addDays(today, -1); return { from: iso(y), to: iso(y), preset }; }
    case "7d": return { from: iso(addDays(today, -6)), to: iso(today), preset };
    case "90d": return { from: iso(addDays(today, -89)), to: iso(today), preset };
    case "month": return { from: iso(startOfMonth(today)), to: iso(today), preset };
    case "last-month": { const m = subMonths(today, 1); return { from: iso(startOfMonth(m)), to: iso(endOfMonth(m)), preset }; }
    default: return { from: iso(addDays(today, -27)), to: iso(today), preset: "28d" };
  }
}

/** The equal-length range right before `r`, for "vs previous period". */
export function previousRange(r: DateRange): { from: string; to: string } {
  const days = differenceInCalendarDays(parseISO(r.to), parseISO(r.from)) + 1;
  return { from: iso(addDays(parseISO(r.from), -days)), to: iso(addDays(parseISO(r.from), -1)) };
}

/** Every day from..to inclusive, so charts show zero days instead of gaps. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = parseISO(from); iso(d) <= to; d = addDays(d, 1)) out.push(iso(d));
  return out;
}

const dayFmt = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", { day: "numeric", month: "short" });
const dateTimeFmt = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", {
  day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ,
});
export const formatDay = (isoDay: string) => dayFmt.format(parseISO(isoDay));
export const formatDateTime = (d: Date | string) => dateTimeFmt.format(new Date(d));
