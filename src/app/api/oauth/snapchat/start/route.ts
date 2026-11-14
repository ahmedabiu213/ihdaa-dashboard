import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorizeUrl, snapchatConfig } from "@/lib/snapchat/client";

/** Signed-in users only (enforced by the proxy). Sends the browser to Snapchat's consent screen. */
export async function GET(req: Request) {
  if (!snapchatConfig()) {
    return NextResponse.redirect(new URL("/settings?error=snapchat-config", req.url));
  }
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("snap_oauth_state", state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/api/oauth/snapchat",
  });
  return NextResponse.redirect(authorizeUrl(state));
}
