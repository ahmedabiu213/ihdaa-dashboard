import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Accepts `Authorization: Bearer <secret>` or `x-api-key: <secret>`. */
export function hasSecret(req: Request, secret: string | undefined) {
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  const given = auth?.startsWith("Bearer ") ? auth.slice(7) : req.headers.get("x-api-key");
  return !!given && safeEqual(given.trim(), secret);
}

export function hmacSha256Hex(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export const json = (data: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(data, { status, headers });
