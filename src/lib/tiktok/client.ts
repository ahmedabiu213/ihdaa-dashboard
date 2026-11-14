import "server-only";
import { decrypt, encrypt } from "@/lib/crypto";
import { getIntegration, saveIntegration } from "@/lib/integrations/store";

/**
 * TikTok API for Business (v1.3).
 * - Advertiser authorization: the user approves on TikTok's page, which redirects
 *   back with `auth_code` (and `state`).
 * - POST /oauth2/access_token/ { app_id, secret, auth_code } → { access_token, advertiser_ids, scope }.
 *   The advertiser access token is long-lived (no refresh flow); it stops working
 *   only if the authorization is revoked, after which you reconnect.
 * - Every call sends the `Access-Token` header; success is `code === 0` in the JSON body.
 */
// Overridable only for local testing against a mock server.
export const API_BASE = process.env.TIKTOK_API_BASE ?? "https://business-api.tiktok.com/open_api/v1.3";
const AUTH_PAGE = process.env.TIKTOK_AUTH_URL ?? "https://business-api.tiktok.com/portal/auth";
const PLATFORM = "tiktok";

export function tiktokConfig() {
  const appId = process.env.TIKTOK_APP_ID;
  const secret = process.env.TIKTOK_APP_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!appId || !secret || !appUrl) return null;
  return { appId, secret, advertiserId: process.env.TIKTOK_ADVERTISER_ID || null, redirectUri: `${appUrl}/api/oauth/tiktok/callback` };
}

function requireConfig() {
  const cfg = tiktokConfig();
  if (!cfg) throw new Error("TikTok env vars are missing (TIKTOK_APP_ID, TIKTOK_APP_SECRET, NEXT_PUBLIC_APP_URL)");
  return cfg;
}

export function authorizeUrl(state: string) {
  const cfg = requireConfig();
  const u = new URL(AUTH_PAGE);
  u.search = new URLSearchParams({ app_id: cfg.appId, state, redirect_uri: cfg.redirectUri }).toString();
  return u.toString();
}

type Envelope<T> = { code: number; message: string; request_id?: string; data: T };

export class TikTokApiError extends Error {
  constructor(public code: number, message: string) { super(message); }
}

async function parse<T>(res: Response, path: string): Promise<T> {
  const text = await res.text();
  let body: Envelope<T>;
  try { body = JSON.parse(text); } catch { throw new Error(`TikTok ${path}: HTTP ${res.status}: ${text.slice(0, 200)}`); }
  if (!res.ok || body.code !== 0) throw new TikTokApiError(body.code ?? res.status, `TikTok ${path}: ${body.code} ${body.message}`);
  return body.data;
}

export async function exchangeCode(authCode: string) {
  const cfg = requireConfig();
  const res = await fetch(`${API_BASE}/oauth2/access_token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: cfg.appId, secret: cfg.secret, auth_code: authCode }),
    cache: "no-store",
  });
  const data = await parse<{ access_token: string; advertiser_ids?: string[]; scope?: number[] }>(res, "/oauth2/access_token/");
  if (!data.access_token) throw new Error("TikTok did not return an access token");
  const advertiserIds = (data.advertiser_ids ?? []).map(String);
  await saveIntegration(PLATFORM, {
    status: "connected",
    accessTokenEnc: encrypt(data.access_token),
    refreshTokenEnc: null,
    tokenExpiresAt: null,
    meta: { advertiserIds },
    lastError: null,
  });
  return advertiserIds;
}

/** The advertiser to sync: TIKTOK_ADVERTISER_ID, else the only one authorized. */
export async function connection() {
  const row = await getIntegration(PLATFORM);
  if (!row?.accessTokenEnc) throw new Error("TikTok is not connected");
  const ids = ((row.meta as { advertiserIds?: string[] } | null)?.advertiserIds ?? []).map(String);
  const configured = tiktokConfig()?.advertiserId;
  const advertiserId = configured ?? (ids.length === 1 ? ids[0] : null);
  if (!advertiserId) throw new Error(`Set TIKTOK_ADVERTISER_ID to one of the authorized advertisers: ${ids.join(", ") || "none"}`);
  if (configured && ids.length > 0 && !ids.includes(configured)) {
    throw new Error(`TIKTOK_ADVERTISER_ID ${configured} was not part of this authorization (${ids.join(", ")}). Reconnect with that account.`);
  }
  return { token: decrypt(row.accessTokenEnc), advertiserId };
}

/** GET with TikTok's convention: arrays/objects in the query string are JSON-encoded. */
export async function ttGet<T>(path: string, token: string, query: Record<string, unknown>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v == null) continue;
    url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  const res = await fetch(url, { headers: { "Access-Token": token }, cache: "no-store" });
  return parse<T>(res, path);
}
