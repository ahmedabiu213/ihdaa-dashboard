"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export type LoginState = { error?: string };

function safeNext(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { error: "تسجيل الدخول غير مُعدّ بعد (متغيرات Supabase غير موجودة)." };
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "أدخل البريد الإلكتروني وكلمة المرور." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  const supabase = await createSupabaseServer();
  await supabase?.auth.signOut();
  redirect("/login");
}
