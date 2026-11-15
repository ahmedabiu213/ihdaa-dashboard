"use server";

import { createSupabaseServer } from "@/lib/supabase/server";

export type PwState = { ok?: string; error?: string };

export async function changePassword(_prev: PwState, form: FormData): Promise<PwState> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { error: "تسجيل الدخول غير مُعدّ." };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "سجّل الدخول أولًا." };
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." };
  if (password !== confirm) return { error: "كلمتا المرور غير متطابقتين." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: "تم تغيير كلمة المرور." };
}
