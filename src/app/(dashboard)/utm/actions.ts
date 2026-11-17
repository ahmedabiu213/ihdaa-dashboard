"use server";

import { revalidatePath } from "next/cache";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { getStaffUser } from "@/lib/supabase/server";

export async function saveUtmLink(input: { platform: string; url: string; label: string | null; productId: number | null }) {
  const user = await getStaffUser();
  if (!user || !isDatabaseConfigured()) return;
  if (!/^https?:\/\//.test(input.url) || input.url.length > 2000) return;
  await getDb().insert(schema.utmLinks).values({
    platform: input.platform.slice(0, 30),
    url: input.url,
    label: input.label?.slice(0, 200) || null,
    productId: input.productId,
    createdBy: user.email,
  });
  revalidatePath("/utm");
}
