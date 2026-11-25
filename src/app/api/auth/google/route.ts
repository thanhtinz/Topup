import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getGoogleConfig } from "@/lib/google";

export async function GET(req: NextRequest) {
  const cfg = await getGoogleConfig();
  if (!cfg.enabled) return NextResponse.redirect(new URL("/?auth=login&err=" + encodeURIComponent("Đăng nhập Google chưa được cấu hình"), req.url));
  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/auth/google/callback", req.nextUrl.origin).toString();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  const res = NextResponse.redirect(url);
  res.cookies.set("g_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
