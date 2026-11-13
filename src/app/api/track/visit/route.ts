import { getDb, schema } from "@/db";
import { resolveChannel } from "@/lib/channels";
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
  const v = r.data;
  const t = v.touch ?? {};
  const now = new Date();
  await getDb().insert(schema.visits).values({
    visitorId: v.vid,
    sessionId: v.sid,
    path: decodeURI(v.path).slice(0, 500),
    title: v.title,
    referrer: v.referrer,
    channel: resolveChannel({ utmSource: t.utm_source, clickIdType: t.click_type, referrer: t.referrer, ownHost: ownHost() }),
    utmSource: t.utm_source, utmMedium: t.utm_medium, utmCampaign: t.utm_campaign,
    utmContent: t.utm_content, utmTerm: t.utm_term,
    clickIdType: t.click_type ?? null, clickId: t.click_id,
    visitedAt: now,
    visitedDate: riyadhDay(now),
  });
  return json({ ok: true }, 200, headers);
}
