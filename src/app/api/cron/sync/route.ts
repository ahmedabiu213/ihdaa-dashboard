import { hasSecret, json } from "@/lib/http";
import { getIntegration } from "@/lib/integrations/store";
import { snapchatConfig } from "@/lib/snapchat/client";
import { syncSnapchat } from "@/lib/snapchat/sync";
import { tiktokConfig } from "@/lib/tiktok/client";
import { syncTiktok } from "@/lib/tiktok/sync";

/**
 * Scheduled spend sync. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 * Re-pulls the last 3 days each run: platforms keep finalizing recent numbers.
 * `?days=N` (max 90) for a manual backfill, `?platform=snapchat|tiktok` for one platform.
 */
const SYNCS = {
  snapchat: { configured: () => !!snapchatConfig(), tokenKey: "refreshTokenEnc" as const, run: syncSnapchat },
  tiktok: { configured: () => !!tiktokConfig(), tokenKey: "accessTokenEnc" as const, run: syncTiktok },
};

export async function GET(req: Request) {
  if (!hasSecret(req, process.env.CRON_SECRET)) return json({ error: "unauthorized" }, 401);
  const params = new URL(req.url).searchParams;
  const days = Math.min(90, Math.max(1, Number(params.get("days")) || 3));
  const only = params.get("platform");
  const results: Record<string, unknown> = {};

  for (const [platform, s] of Object.entries(SYNCS)) {
    if (only && only !== platform) continue;
    const row = s.configured() ? await getIntegration(platform) : null;
    if (!row?.[s.tokenKey]) { results[platform] = "not connected"; continue; }
    try { results[platform] = await s.run(days); }
    catch (e) { results[platform] = { error: e instanceof Error ? e.message : String(e) }; }
  }
  return json({ ok: true, results });
}
