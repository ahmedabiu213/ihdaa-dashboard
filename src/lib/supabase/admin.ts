import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

/**
 * Supabase admin client (service role / secret key). Server only: it can create,
 * change and delete any login. Never import this from a client component.
 */
export function supabaseAdmin() {
  const cfg = supabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cfg || !key) return null;
  return createClient(cfg.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
