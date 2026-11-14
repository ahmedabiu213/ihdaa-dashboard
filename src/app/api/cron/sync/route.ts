import { hasSecret, json } from "@/lib/http";
import { snapchatConfig } from "@/lib/snapchat/client";
import { getIntegration } from "@/lib/integrations/store";
import { syncSnapchat } from "@/lib/snapchat/sync";

/**
 * Scheduled spend sync. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 * Re-pulls the last 3 days each run: Snapchat keeps finalizing recent numbers.
 * `?days=N` (max 90) for a manual backfill.
 */
export async function GET(req: Request) {
  if (!hasSecret(req, process.env.CRON_SECRET)) return json({ error: "unauthorized" }, 401);
  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 3));
  const results: Record<string, unknown> = {};

  if (snapchatConfig() && (await getIntegration("snapchat"))?.refreshTokenEnc) {
    try { results.snapchat = await syncSnapchat(days); }
    catch (e) { results.snapchat = { error: e instanceof Error ? e.message : String(e) }; }
  } else {
    results.snapchat = "not connected";
  }
  return json({ ok: true, results });
}
