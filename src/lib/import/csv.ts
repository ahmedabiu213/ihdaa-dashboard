import Papa from "papaparse";

/** Parse a CSV (UTF-8, with or without BOM, comma or semicolon) into header-keyed rows. */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = text.replace(/^﻿/, "");
  const res = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
    delimitersToGuess: [",", ";", "\t"],
  });
  return { headers: (res.meta.fields ?? []).filter(Boolean), rows: res.data };
}

/** Normalize a header for alias matching: lowercase, no spaces/underscores/punctuation, Arabic kept. */
export function headerKey(h: string) {
  return h.toLowerCase().replace(/[\s_\-()./:]+/g, "").replace(/[إأآ]/g, "ا").replace(/ة/g, "ه");
}

/** Find which actual header matches one of the aliases. */
export function pickHeader(headers: string[], aliases: string[]): string | null {
  const keys = new Map(headers.map((h) => [headerKey(h), h]));
  for (const a of aliases) {
    const hit = keys.get(headerKey(a));
    if (hit) return hit;
  }
  return null;
}

/** Numbers like "1,234.50", "١٬٢٣٤٫٥", "SAR 120", "120 ر.س". */
export function parseAmount(v: string | undefined | null): number | null {
  if (v == null) return null;
  let s = "";
  for (const ch of String(v)) {
    const c = ch.charCodeAt(0);
    if (c >= 0x0660 && c <= 0x0669) s += String(c - 0x0660);
    else if (c >= 0x06f0 && c <= 0x06f9) s += String(c - 0x06f0);
    else if (ch === "٫") s += ".";
    else if (ch === "٬") s += ",";
    else s += ch;
  }
  const m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Dates like 2026-11-14, 2026/11/14, 14/11/2026, 14-11-2026, with optional time. Returns YYYY-MM-DD. */
export function parseDay(v: string | undefined | null): string | null {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
