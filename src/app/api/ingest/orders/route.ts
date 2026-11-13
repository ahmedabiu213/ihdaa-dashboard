import { hasSecret, json } from "@/lib/http";
import { ingestSallaPayload } from "@/lib/orders/ingest";

/**
 * Verified order intake for Salla order JSON, from:
 * - Make.com (Salla "Watch Order …" trigger → HTTP module), `?source=make`
 * - anything else holding the secret that forwards Salla's order object.
 *
 * Auth: `Authorization: Bearer $ORDERS_INGEST_SECRET` (or `x-api-key`).
 * Body: a Salla order, the webhook envelope `{ event, data }`, or an array of either.
 */
export async function POST(req: Request) {
  if (!hasSecret(req, process.env.ORDERS_INGEST_SECRET)) return json({ error: "unauthorized" }, 401);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const event = typeof body === "object" && body && "event" in body ? String((body as { event: unknown }).event) : null;
  try {
    const results = await ingestSallaPayload(body, "make", event);
    return json({ ok: true, results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "failed" }, 422);
  }
}
