import { cookies } from "next/headers";
import { NextResponse, after, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/http";
import { exchangeCode } from "@/lib/tiktok/client";
import { syncTiktok } from "@/lib/tiktok/sync";

/** TikTok redirects here with `auth_code` (some flows also send `code`) and our `state`. */
export async function GET(req: NextRequest) {
  const store = await cookies();
  const expected = store.get("tt_oauth_state")?.value;
  store.delete({ name: "tt_oauth_state", path: "/api/oauth/tiktok" });
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("auth_code") ?? searchParams.get("code");
  const state = searchParams.get("state") ?? "";
  const back = (q: string) => NextResponse.redirect(new URL(`/settings?${q}`, req.url));

  if (!code) return back("error=tiktok-denied");
  if (!expected || !safeEqual(state, expected)) return back("error=tiktok-state");
  try {
    await exchangeCode(code);
  } catch (e) {
    console.error("[tiktok] code exchange failed", e);
    return back("error=tiktok-token");
  }
  after(async () => {
    try { await syncTiktok(90); } catch (e) { console.error("[tiktok] initial sync failed", e); }
  });
  return back("connected=tiktok");
}
