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

export type Role = "admin" | "member";
export type CurrentUser = { id: string; email: string; role: Role };

/** The signed-in user, or null. Without Supabase config (local dev only) returns a placeholder admin. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServer();
  if (!supabase) return process.env.NODE_ENV === "production" ? null : { id: "dev", email: "dev@localhost", role: "admin" };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  // The role lives in app_metadata, which only the server (service key) can change.
  const role: Role = data.user.app_metadata?.role === "admin" ? "admin" : "member";
  return { id: data.user.id, email: data.user.email ?? "", role };
}
