import { cookies } from "next/headers";
import { NextResponse, after, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/http";
import { exchangeCode } from "@/lib/snapchat/client";
import { syncSnapchat } from "@/lib/snapchat/sync";

export async function GET(req: NextRequest) {
  const store = await cookies();
  const expected = store.get("snap_oauth_state")?.value;
  store.delete({ name: "snap_oauth_state", path: "/api/oauth/snapchat" });
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state") ?? "";
  const back = (q: string) => NextResponse.redirect(new URL(`/settings?${q}`, req.url));

  if (!code) return back("error=snapchat-denied");
  if (!expected || !safeEqual(state, expected)) return back("error=snapchat-state");
  try {
    await exchangeCode(code);
  } catch (e) {
    console.error("[snapchat] code exchange failed", e);
    return back("error=snapchat-token");
  }
  // Backfill the last 90 days after responding, so the redirect is instant.
  after(async () => {
    try { await syncSnapchat(90); } catch (e) { console.error("[snapchat] initial sync failed", e); }
  });
  return back("connected=snapchat");
}
