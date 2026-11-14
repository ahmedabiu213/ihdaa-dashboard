"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/server";
import { syncSnapchat } from "@/lib/snapchat/sync";
import { saveIntegration } from "@/lib/integrations/store";

export type ActionState = { ok?: string; error?: string };

export async function syncSnapchatNow(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "سجّل الدخول أولًا." };
  const days = Math.min(90, Math.max(1, Number(form.get("days")) || 7));
  try {
    const r = await syncSnapchat(days);
    revalidatePath("/", "layout");
    return { ok: `تمت المزامنة: ${r.rows} صف من ${r.from} إلى ${r.to}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "فشلت المزامنة" };
  }
}

export async function disconnectSnapchat(): Promise<void> {
  if (!(await getCurrentUser())) return;
  await saveIntegration("snapchat", { status: "disconnected", accessTokenEnc: null, refreshTokenEnc: null, tokenExpiresAt: null });
  revalidatePath("/settings");
}
