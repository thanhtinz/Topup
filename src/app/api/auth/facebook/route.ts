import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getFacebookConfig } from "@/lib/facebook";

export async function GET(req: NextRequest) {
  const cfg = await getFacebookConfig();
  if (!cfg.enabled) return NextResponse.redirect(new URL("/?auth=login&err=" + encodeURIComponent("Đăng nhập Facebook chưa được cấu hình"), req.url));
  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/auth/facebook/callback", req.nextUrl.origin).toString();
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "email,public_profile");
  url.searchParams.set("state", state);
  const res = NextResponse.redirect(url);
  res.cookies.set("fb_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
