import "server-only";
import { z } from "zod";

/**
 * The script sends `text/plain` (sendBeacon / simple fetch) so browsers skip
 * the CORS preflight. Only allow-listed store origins are accepted.
 */
export function storeOrigins() {
  return (process.env.STORE_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin");
  const allowed = storeOrigins();
  if (allowed.length === 0) return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST" };
  return origin && allowed.includes(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST", Vary: "Origin" }
    : {};
}

export async function readTracked<T extends z.ZodType>(req: Request, schema: T) {
  const allowed = storeOrigins();
  const origin = req.headers.get("origin");
  if (allowed.length > 0 && (!origin || !allowed.includes(origin))) return { error: "origin not allowed" as const };
  const text = await req.text();
  if (text.length > 20_000) return { error: "too large" as const };
  let body: unknown;
  try { body = JSON.parse(text); } catch { return { error: "invalid json" as const }; }
  const parsed = schema.safeParse(body);
  return parsed.success ? { data: parsed.data as z.infer<T> } : { error: "invalid body" as const };
}

export function ownHost() {
  const first = storeOrigins()[0];
  try { return first ? new URL(first).hostname : null; } catch { return null; }
}
