import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

export async function createSupabaseServer() {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  const store = await cookies();
  return createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes them.
        }
      },
    },
  });
}

/** The signed-in user, or null. Without Supabase config (local dev only) returns a placeholder. */
export async function getCurrentUser(): Promise<{ email: string } | null> {
  const supabase = await createSupabaseServer();
  if (!supabase) return process.env.NODE_ENV === "production" ? null : { email: "dev@localhost" };
  const { data } = await supabase.auth.getUser();
  return data.user ? { email: data.user.email ?? "" } : null;
}
