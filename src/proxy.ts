import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";

/**
 * Machine endpoints authenticate themselves (signatures, shared secrets) and
 * the storefront script must be public. Everything else needs a signed-in user.
 */
const PUBLIC_PREFIXES = ["/login", "/api/track", "/api/webhooks", "/api/ingest", "/api/cron", "/t.js"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const cfg = supabaseConfig();
  if (!cfg) {
    // Local development without Supabase: allow, so the UI can be previewed.
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("Authentication is not configured (Supabase env vars missing).", { status: 503 });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser() validates the token with Supabase and refreshes the session cookie.
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
