import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorizeUrl, tiktokConfig } from "@/lib/tiktok/client";

export async function GET(req: Request) {
  if (!tiktokConfig()) return NextResponse.redirect(new URL("/settings?error=tiktok-config", req.url));
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("tt_oauth_state", state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/api/oauth/tiktok",
  });
  return NextResponse.redirect(authorizeUrl(state));
}
