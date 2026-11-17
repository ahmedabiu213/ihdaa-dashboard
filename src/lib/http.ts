import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const KEY_HEADERS = ["x-api-key", "api-key", "apikey", "x-ingest-key"];

/** Every place a client might put the key: Authorization (with or without "Bearer"), key headers, ?key=. */
export function providedSecrets(req: Request): string[] {
  const out: string[] = [];
  const auth = req.headers.get("authorization");
  if (auth) out.push(auth.replace(/^\s*bearer\s+/i, "").trim());
  for (const h of KEY_HEADERS) {
    const v = req.headers.get(h);
    if (v) out.push(v.replace(/^\s*bearer\s+/i, "").trim());
  }
  try {
    const q = new URL(req.url).searchParams.get("key");
    if (q) out.push(q.trim());
  } catch { /* ignore */ }
  return out.filter(Boolean);
}

/** True when any provided key matches. Comparison is constant-time per candidate. */
export function hasSecret(req: Request, secret: string | undefined) {
  if (!secret) return false;
  return providedSecrets(req).some((given) => safeEqual(given, secret.trim()));
}

/** Names of the auth headers present (never values), for diagnosing rejected requests. */
export function authHeaderSummary(req: Request) {
  return ["authorization", ...KEY_HEADERS].filter((h) => req.headers.get(h)).join(", ") || "none";
}

export function hmacSha256Hex(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export const json = (data: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(data, { status, headers });
