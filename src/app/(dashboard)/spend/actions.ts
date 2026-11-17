"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getStaffUser } from "@/lib/supabase/server";
import { parseAmount, parseDay } from "@/lib/import/csv";
import { normalizePlatform, parseSpendCsv, upsertManualSpend } from "@/lib/import/spend";

export type FormState = { ok?: string; error?: string; details?: string[] };

export async function addSpend(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getStaffUser();
  if (!user) return { error: "سجّل الدخول أولًا." };
  const date = parseDay(String(form.get("date") ?? ""));
  const platform = normalizePlatform(String(form.get("platform") ?? ""));
  const spend = parseAmount(String(form.get("spend") ?? ""));
  if (!date) return { error: "اختر التاريخ." };
  if (!platform) return { error: "اختر المنصة." };
  if (spend == null || spend < 0) return { error: "أدخل مبلغًا صحيحًا." };
  await upsertManualSpend([{
    date, platform, spend,
    currency: String(form.get("currency") ?? "SAR"),
    campaign: String(form.get("campaign") ?? "") || null,
    note: `${user.email}${form.get("note") ? ` · ${form.get("note")}` : ""}`,
  }], "manual");
  revalidatePath("/", "layout");
  return { ok: "تم الحفظ. إدخال نفس المنصة واليوم والحملة مرة أخرى يستبدل المبلغ." };
}

export async function importSpend(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await getStaffUser())) return { error: "سجّل الدخول أولًا." };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "اختر ملف CSV." };
  if (file.size > 5_000_000) return { error: "الملف أكبر من 5 ميجابايت." };
  const fallback = normalizePlatform(String(form.get("platform") ?? ""));
  const { rows, report } = parseSpendCsv(await file.text(), fallback);
  if (rows.length === 0) return { error: "لم يتم استيراد أي صف.", details: report.skipped.slice(0, 8).map((s) => `سطر ${s.line}: ${s.reason}`) };
  const n = await upsertManualSpend(rows, "csv");
  revalidatePath("/", "layout");
  return {
    ok: `تم استيراد ${n} صف.`,
    details: report.skipped.length ? [`تم تخطي ${report.skipped.length} صف:`, ...report.skipped.slice(0, 8).map((s) => `سطر ${s.line}: ${s.reason}`)] : undefined,
  };
}

export async function deleteSpend(form: FormData): Promise<void> {
  if (!(await getStaffUser())) return;
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  // Only hand-entered rows can be deleted here; API rows are owned by the sync.
  await getDb().delete(schema.spendDaily)
    .where(and(eq(schema.spendDaily.id, id), inArray(schema.spendDaily.source, ["manual", "csv"])));
  revalidatePath("/", "layout");
}
