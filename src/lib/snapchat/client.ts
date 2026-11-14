import "server-only";
import { decrypt, encrypt } from "@/lib/crypto";
import { getIntegration, saveIntegration } from "@/lib/integrations/store";

/**
 * Snapchat Marketing API client.
 * Docs: developers.snap.com/api/marketing-api/Ads-API/authentication
 * - Access tokens last 3600 s; refresh tokens don't expire unless the user loses access.
 * - redirect_uri is required on the code exchange and must match /authorize.
 */
// Overridable only for local testing against a mock server.
const AUTH_BASE = process.env.SNAPCHAT_AUTH_BASE ?? "https://accounts.snapchat.com/login/oauth2";
export const API_BASE = process.env.SNAPCHAT_API_BASE ?? "https://adsapi.snapchat.com/v1";
const PLATFORM = "snapchat";

export function snapchatConfig() {
  const clientId = process.env.SNAPCHAT_CLIENT_ID;
  const clientSecret = process.env.SNAPCHAT_CLIENT_SECRET;
  const adAccountId = process.env.SNAPCHAT_AD_ACCOUNT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!clientId || !clientSecret || !adAccountId || !appUrl) return null;
  return { clientId, clientSecret, adAccountId, redirectUri: `${appUrl}/api/oauth/snapchat/callback` };
}

function requireConfig() {
  const cfg = snapchatConfig();
  if (!cfg) throw new Error("Snapchat env vars are missing (SNAPCHAT_CLIENT_ID, SNAPCHAT_CLIENT_SECRET, SNAPCHAT_AD_ACCOUNT_ID, NEXT_PUBLIC_APP_URL)");
  return cfg;
}

export function authorizeUrl(state: string) {
  const cfg = requireConfig();
  const u = new URL(`${AUTH_BASE}/authorize`);
  u.search = new URLSearchParams({
    response_type: "code", client_id: cfg.clientId, redirect_uri: cfg.redirectUri, scope: "snapchat-marketing-api", state,
  }).toString();
  return u.toString();
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${AUTH_BASE}/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Snapchat token request failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text) as TokenResponse;
}

async function storeTokens(t: TokenResponse, previousRefresh?: string) {
  const refresh = t.refresh_token ?? previousRefresh;
  await saveIntegration(PLATFORM, {
    status: "connected",
    accessTokenEnc: encrypt(t.access_token),
    ...(refresh ? { refreshTokenEnc: encrypt(refresh) } : {}),
    tokenExpiresAt: new Date(Date.now() + (t.expires_in - 120) * 1000), // refresh 2 min early
    lastError: null,
  });
  return t.access_token;
}

export async function exchangeCode(code: string) {
  const cfg = requireConfig();
  const t = await tokenRequest({
    grant_type: "authorization_code", client_id: cfg.clientId, client_secret: cfg.clientSecret, code, redirect_uri: cfg.redirectUri,
  });
  if (!t.refresh_token) throw new Error("Snapchat did not return a refresh token");
  await storeTokens(t);
}

async function refreshAccessToken() {
  const cfg = requireConfig();
  const row = await getIntegration(PLATFORM);
  if (!row?.refreshTokenEnc) throw new Error("Snapchat is not connected");
  const refresh = decrypt(row.refreshTokenEnc);
  const t = await tokenRequest({
    grant_type: "refresh_token", client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: refresh,
  });
  return storeTokens(t, refresh);
}

async function accessToken(forceRefresh = false) {
  const row = await getIntegration(PLATFORM);
  if (!forceRefresh && row?.accessTokenEnc && row.tokenExpiresAt && row.tokenExpiresAt > new Date()) {
    return decrypt(row.accessTokenEnc);
  }
  return refreshAccessToken();
}

/** GET a path (or a full `next_link` URL). Retries once with a fresh token on 401. */
export async function snapGet<T>(pathOrUrl: string, query?: Record<string, string>): Promise<T> {
  const url = new URL(pathOrUrl.startsWith("http") ? pathOrUrl : `${API_BASE}${pathOrUrl}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await accessToken(attempt > 0);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (res.status === 401 && attempt === 0) continue;
    const text = await res.text();
    if (!res.ok) throw new Error(`Snapchat API ${res.status} on ${url.pathname}: ${text.slice(0, 300)}`);
    return JSON.parse(text) as T;
  }
  throw new Error("Snapchat API: unauthorized after token refresh");
}

/** Follow `paging.next_link` until done. `listKey`/`itemKey` e.g. "campaigns"/"campaign". */
export async function snapList<T>(path: string, listKey: string, itemKey: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = `${API_BASE}${path}${path.includes("?") ? "&" : "?"}limit=1000`;
  for (let page = 0; next && page < 50; page++) {
    const body: Record<string, unknown> & { paging?: { next_link?: string } } = await snapGet(next);
    const list = (body[listKey] as Array<Record<string, T>> | undefined) ?? [];
    for (const wrapper of list) if (wrapper[itemKey]) out.push(wrapper[itemKey]);
    next = body.paging?.next_link ?? null;
  }
  return out;
}
