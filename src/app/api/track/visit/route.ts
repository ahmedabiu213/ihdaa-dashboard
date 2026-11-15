import { getDb, schema } from "@/db";
import { appFromUserAgent, isBotUserAgent, resolveChannel } from "@/lib/channels";
import { riyadhDay } from "@/lib/dates";
import { json } from "@/lib/http";
import { corsHeaders, ownHost, readTracked } from "@/lib/tracking/request";
import { visitSchema } from "@/lib/tracking/schemas";

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: { ...corsHeaders(req), "Access-Control-Allow-Headers": "content-type" } });
}

export async function POST(req: Request) {
  const headers = corsHeaders(req);
  const r = await readTracked(req, visitSchema);
  if ("error" in r) return json({ error: r.error }, 400, headers);
  const ua = req.headers.get("user-agent");
  if (isBotUserAgent(ua)) return json({ ok: true, skipped: "bot" }, 200, headers);
  const uaApp = appFromUserAgent(ua);
  const v = r.data;
  const t = v.touch ?? {};
  const now = new Date();
  let path = v.path;
  try { path = decodeURI(v.path); } catch { /* keep the raw path */ }
  if (path.length > 1) path = path.replace(/\/+$/, ""); // "/ar/" and "/ar" are one page
  await getDb().insert(schema.visits).values({
    visitorId: v.vid,
    sessionId: v.sid,
    path: path.slice(0, 500),
    title: v.title,
    referrer: v.referrer,
    channel: resolveChannel({ utmSource: t.utm_source, clickIdType: t.click_type, referrer: t.referrer, ownHost: ownHost(), uaApp }),
    utmSource: t.utm_source, utmMedium: t.utm_medium, utmCampaign: t.utm_campaign,
    utmContent: t.utm_content, utmTerm: t.utm_term, utmId: t.utm_id,
    clickIdType: t.click_type ?? null, clickId: t.click_id,
    uaApp, query: v.q,
    visitedAt: now,
    visitedDate: riyadhDay(now),
  });
  return json({ ok: true }, 200, headers);
}
