"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, type Role } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type UserFormState = { ok?: string; error?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 10;

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me) return { error: "سجّل الدخول أولًا." } as const;
  if (me.role !== "admin") return { error: "هذه العملية للمسؤولين فقط." } as const;
  const admin = supabaseAdmin();
  if (!admin) return { error: "أضف SUPABASE_SERVICE_ROLE_KEY في Vercel ثم أعد النشر." } as const;
  return { me, admin } as const;
}

const roleOf = (v: FormDataEntryValue | null): Role => (v === "admin" ? "admin" : "member");

/** Number of admins other than `exceptId`, so the last admin can't be removed or demoted. */
async function otherAdmins(admin: NonNullable<ReturnType<typeof supabaseAdmin>>, exceptId: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return (data?.users ?? []).filter((u) => u.id !== exceptId && u.app_metadata?.role === "admin").length;
}

export async function createUser(_prev: UserFormState, form: FormData): Promise<UserFormState> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!EMAIL.test(email)) return { error: "أدخل بريدًا إلكترونيًا صحيحًا." };
  if (password.length < MIN_PASSWORD) return { error: `كلمة المرور يجب أن تكون ${MIN_PASSWORD} أحرف على الأقل.` };
  const { error } = await ctx.admin.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { role: roleOf(form.get("role")) },
  });
  if (error) return { error: /already|exists|registered/i.test(error.message) ? "هذا البريد مسجّل مسبقًا." : error.message };
  revalidatePath("/users");
  return { ok: `تم إنشاء الحساب ${email}. يمكنه تسجيل الدخول الآن.` };
}

export async function setPassword(_prev: UserFormState, form: FormData): Promise<UserFormState> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const id = String(form.get("id") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < MIN_PASSWORD) return { error: `كلمة المرور يجب أن تكون ${MIN_PASSWORD} أحرف على الأقل.` };
  const { error } = await ctx.admin.auth.admin.updateUserById(id, { password });
  if (error) return { error: error.message };
  return { ok: "تم تغيير كلمة المرور." };
}

export async function setRole(form: FormData): Promise<void> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return;
  const id = String(form.get("id") ?? "");
  const role = roleOf(form.get("role"));
  if (role !== "admin" && (await otherAdmins(ctx.admin, id)) === 0) return; // keep at least one admin
  await ctx.admin.auth.admin.updateUserById(id, { app_metadata: { role } });
  revalidatePath("/users");
}

export async function deleteUser(_prev: UserFormState, form: FormData): Promise<UserFormState> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const id = String(form.get("id") ?? "");
  if (id === ctx.me.id) return { error: "لا يمكنك حذف حسابك الحالي." };
  if ((await otherAdmins(ctx.admin, id)) === 0) return { error: "لا يمكن حذف آخر مسؤول." };
  const { error } = await ctx.admin.auth.admin.deleteUser(id);
  if (error) return { error: error.message };
  revalidatePath("/users");
  return { ok: "تم حذف الحساب." };
}
