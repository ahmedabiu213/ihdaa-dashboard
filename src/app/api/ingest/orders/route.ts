import { getDb, schema } from "@/db";
import { authHeaderSummary, hasSecret, json, providedSecrets } from "@/lib/http";
import { ingestSallaPayload } from "@/lib/orders/ingest";
import { invoiceToOrder } from "@/lib/orders/invoice";
import { getSecret } from "@/lib/config/secrets";

/**
 * Verified order intake for Salla order JSON (Make.com, or anything holding the secret).
 *
 * Auth: the ORDERS_INGEST_SECRET in `Authorization` (with or without "Bearer"),
 * `x-api-key`, or `?key=`.
 * Body: a Salla order, the webhook envelope `{ event, data }`, an array of either,
 * a JSON string of any of those (double-encoded), or a form field holding JSON.
 *
 * Every attempt is logged in webhook_events, including rejected ones (without
 * secrets), so a misconfigured sender is visible on the settings page.
 */
async function logRejected(reason: string, detail: Record<string, unknown>) {
  try {
    await getDb().insert(schema.webhookEvents).values({ source: "make", event: "rejected", payload: detail, processed: false, error: reason });
  } catch { /* logging must never break the response */ }
}

/** Unwrap whatever shape the sender produced into a JSON value. */
function parseBody(text: string, contentType: string): unknown {
  const tryJson = (t: string): unknown => { try { return JSON.parse(t); } catch { return undefined; } };
  let body: unknown = tryJson(text);
  if (body === undefined && /form-urlencoded/i.test(contentType)) {
    const form = new URLSearchParams(text);
    for (const k of ["data", "payload", "json", "body", "order"]) {
      const v = form.get(k);
      if (v) { body = tryJson(v); if (body !== undefined) break; }
    }
  }
  // Double-encoded: a JSON string containing JSON.
  for (let i = 0; i < 2 && typeof body === "string"; i++) body = tryJson(body) ?? body;
  // A wrapper object holding the JSON as a string, e.g. { "json": "{…}" } from Make's Transform to JSON.
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const entries = Object.entries(body as Record<string, unknown>);
    if (entries.length === 1 && typeof entries[0][1] === "string") {
      const inner = tryJson(entries[0][1] as string);
      if (inner && typeof inner === "object") body = inner;
    }
  }
  return body;
}

export async function POST(req: Request) {
  // Vercel variable first, then the database fallback (app_secrets).
  const secret = (await getSecret("ORDERS_INGEST_SECRET").catch(() => ({ value: null }))).value;
  if (!secret) return json({ error: "ORDERS_INGEST_SECRET is not set on the server" }, 503);
  if (!hasSecret(req, secret)) {
    const given = providedSecrets(req);
    await logRejected("unauthorized", {
      auth_headers: authHeaderSummary(req),
      // Lengths only, never values: a mismatch usually means a missing/extra character or the wrong key.
      provided_lengths: given.map((g) => g.length),
      expected_length: secret.trim().length,
      user_agent: req.headers.get("user-agent")?.slice(0, 120) ?? null,
    });
    return json({ error: "unauthorized: the key does not match ORDERS_INGEST_SECRET" }, 401);
  }

  const contentType = req.headers.get("content-type") ?? "";
  const text = await req.text().catch(() => "");
  const body = parseBody(text, contentType);
  if (body === undefined || body === null || typeof body !== "object") {
    await logRejected("invalid body", { content_type: contentType, length: text.length, start: text.slice(0, 300) });
    return json({ error: "invalid body: expected Salla order JSON" }, 400);
  }

  const event = !Array.isArray(body) && "event" in body ? String((body as { event: unknown }).event) : null;
  // Non-order events (e.g. payment events from Salla's store webhooks) may carry a payment id
  // where an order id is expected: keep them for inspection instead of creating a wrong order.
  // «انشاء فاتورة طلب»: the only order event Salla's store webhooks expose right now.
  if (event === "invoice.created") {
    const { order, creditNote } = invoiceToOrder(body);
    try {
      const results = await ingestSallaPayload({ ...(body as object), data: order }, "salla_webhook", event, creditNote ? "restored" : null);
      return json({ ok: true, results });
    } catch (e) {
      const message = e instanceof Error ? e.message : "failed";
      if (message.startsWith("partial order event")) return json({ ok: false, note: message });
      return json({ error: message }, 422);
    }
  }
  if (event && !event.startsWith("order.")) {
    try {
      await getDb().insert(schema.webhookEvents).values({ source: "make", event, payload: body as object, processed: false, error: "not an order event (saved for review)" });
    } catch { /* ignore */ }
    return json({ ok: true, ignored: event });
  }
  // Deleted, cancelled and refunded orders stop counting, whatever their payload holds.
  const forcedStatus = event === "order.deleted" ? "deleted" : event === "order.cancelled" ? "canceled" : event === "order.refunded" ? "restored" : null;
  try {
    const results = await ingestSallaPayload(body, "make", event, forcedStatus);
    return json({ ok: true, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed";
    // Saved for review; answer 200 so the sender doesn't retry forever.
    if (message.startsWith("partial order event")) return json({ ok: false, note: message });
    return json({ error: message }, 422);
  }
}
