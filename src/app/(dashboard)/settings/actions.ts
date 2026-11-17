"use server";

import { revalidatePath } from "next/cache";
import { getStaffUser } from "@/lib/supabase/server";
import { syncSnapchat } from "@/lib/snapchat/sync";
import { syncTiktok } from "@/lib/tiktok/sync";
import { saveIntegration } from "@/lib/integrations/store";

export type ActionState = { ok?: string; error?: string };
const SYNCS = { snapchat: syncSnapchat, tiktok: syncTiktok };
type Platform = keyof typeof SYNCS;
const isPlatform = (v: unknown): v is Platform => typeof v === "string" && v in SYNCS;

export async function syncNow(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await getStaffUser())) return { error: "سجّل الدخول أولًا." };
  const platform = form.get("platform");
  if (!isPlatform(platform)) return { error: "منصة غير معروفة" };
  const days = Math.min(90, Math.max(1, Number(form.get("days")) || 7));
  try {
    const r = await SYNCS[platform](days);
    revalidatePath("/", "layout");
    return { ok: `تمت المزامنة: ${r.rows} صف من ${r.from} إلى ${r.to}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "فشلت المزامنة" };
  }
}

export async function disconnect(form: FormData): Promise<void> {
  if (!(await getStaffUser())) return;
  const platform = form.get("platform");
  if (!isPlatform(platform)) return;
  await saveIntegration(platform, { status: "disconnected", accessTokenEnc: null, refreshTokenEnc: null, tokenExpiresAt: null });
  revalidatePath("/settings");
}
