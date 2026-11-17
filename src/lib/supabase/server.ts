import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";
import { roleOf, type Role } from "@/lib/roles";

export type { Role };

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

export type CurrentUser = { id: string; email: string; role: Role };

/** The signed-in user, or null. Without Supabase config (local dev only) returns a placeholder admin. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServer();
  // DEV_ROLE previews another role locally (e.g. DEV_ROLE=viewer); never used in production.
  if (!supabase) return process.env.NODE_ENV === "production" ? null : { id: "dev", email: "dev@localhost", role: roleOf(process.env.DEV_ROLE ?? "admin") };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  // The role lives in app_metadata, which only the server (service key) can change.
  const role = roleOf(data.user.app_metadata?.role);
  return { id: data.user.id, email: data.user.email ?? "", role };
}

/**
 * The signed-in user if they may use the marketing tools (spend, UTM, sync, imports).
 * Server actions can be called from any page, so each tool action checks this itself.
 */
export async function getStaffUser(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user && user.role !== "viewer" ? user : null;
}
