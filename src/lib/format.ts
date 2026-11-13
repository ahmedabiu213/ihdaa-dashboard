/**
 * Arabic UI with Western digits (0-9), as is common in Saudi business tools.
 * Change NUMBER_LOCALE to "ar-SA" to show Arabic-Indic digits instead.
 */
const NUMBER_LOCALE = "ar-SA-u-nu-latn";

const sarFmt = new Intl.NumberFormat(NUMBER_LOCALE, { maximumFractionDigits: 0 });
const sarFmt2 = new Intl.NumberFormat(NUMBER_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat(NUMBER_LOCALE, { maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat(NUMBER_LOCALE, { notation: "compact", maximumFractionDigits: 1 });

export const formatSar = (v: number, decimals = false) => `${(decimals ? sarFmt2 : sarFmt).format(v)} ر.س`;
export const formatInt = (v: number) => intFmt.format(v);
export const formatCompact = (v: number) => compactFmt.format(v);
export const formatPercent = (v: number) => `${intFmt.format(Math.round(v * 1000) / 10)}٪`;
export const formatRatio = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)}x`);

export function toNumber(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
