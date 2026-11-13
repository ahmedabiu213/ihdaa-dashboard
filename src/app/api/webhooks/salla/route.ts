import { hmacSha256Hex, json, safeEqual } from "@/lib/http";
import { ingestSallaPayload } from "@/lib/orders/ingest";

/**
 * Salla Partners-app webhook (used once the Partners app is approved).
 * Salla signs the raw body with HMAC-SHA256 using the app's webhook secret and
 * sends it in `x-salla-signature`. Check the header name against the app's
 * settings page when the app is created.
 */
export async function POST(req: Request) {
  const secret = process.env.SALLA_WEBHOOK_SECRET;
  if (!secret) return json({ error: "not configured" }, 503);
  const raw = await req.text();
  const sig = req.headers.get("x-salla-signature") ?? "";
  if (!sig || !safeEqual(sig, hmacSha256Hex(secret, raw))) return json({ error: "bad signature" }, 401);

  let body: { event?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!body.event?.startsWith("order.")) return json({ ok: true, ignored: body.event ?? null });
  try {
    const results = await ingestSallaPayload(body, "salla_webhook", body.event);
    return json({ ok: true, results });
  } catch (e) {
    // 2xx would stop Salla retrying; a 5xx lets it retry after a parser fix.
    return json({ error: e instanceof Error ? e.message : "failed" }, 500);
  }
}
