import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { getGoogleConfig } from "@/lib/google";
import { makeSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET(req: NextRequest) {
  const fail = (m: string) => NextResponse.redirect(new URL("/?auth=login&err=" + encodeURIComponent(m), req.url));
  const cfg = await getGoogleConfig();
  if (!cfg.enabled) return fail("Đăng nhập Google chưa được cấu hình");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get("g_oauth_state")?.value;
  if (!code || !state || !savedState || state !== savedState) return fail("Phiên đăng nhập Google không hợp lệ, hãy thử lại");

  const redirectUri = new URL("/api/auth/google/callback", req.nextUrl.origin).toString();
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!tokenRes.ok) return fail("Không đổi được mã đăng nhập Google");
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) return fail("Không lấy được thông tin tài khoản Google");
  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!infoRes.ok) return fail("Không lấy được thông tin tài khoản Google");
  const info = (await infoRes.json()) as { email?: string; name?: string; email_verified?: boolean };
  const email = (info.email ?? "").trim().toLowerCase();
  if (!email || info.email_verified === false) return fail("Email Google chưa được xác thực");

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: (info.name ?? email.split("@")[0]).slice(0, 60),
        email,
        passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10),
      },
    });
  }
  if (!user.active) return fail("Tài khoản đã bị khoá");
  const res = NextResponse.redirect(new URL("/account", req.url));
  res.cookies.set(SESSION_COOKIE_NAME, makeSessionToken(user.id, user.role), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 24 * 3600,
  });
  res.cookies.delete("g_oauth_state");
  return res;
}
