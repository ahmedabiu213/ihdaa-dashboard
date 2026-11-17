"use server";

import { revalidatePath } from "next/cache";
import { getStaffUser } from "@/lib/supabase/server";
import { importSallaOrdersCsv } from "@/lib/import/orders";

export type ImportState = { ok?: string; error?: string; details?: string[] };

export async function importOrders(_prev: ImportState, form: FormData): Promise<ImportState> {
  if (!(await getStaffUser())) return { error: "سجّل الدخول أولًا." };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "اختر ملف CSV." };
  if (file.size > 10_000_000) return { error: "الملف أكبر من 10 ميجابايت." };
  const r = await importSallaOrdersCsv(await file.text());
  revalidatePath("/", "layout");
  const details = r.skipped.slice(0, 8).map((s) => `سطر ${s.line}: ${s.reason}`);
  if (r.created + r.updated === 0) return { error: "لم يتم استيراد أي طلب.", details };
  return {
    ok: `تم استيراد ${r.created} طلب جديد وتحديث ${r.updated} طلب.`,
    details: r.skipped.length ? [`تم تخطي ${r.skipped.length}:`, ...details] : undefined,
  };
}
