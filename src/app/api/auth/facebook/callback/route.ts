import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { getFacebookConfig } from "@/lib/facebook";
import { makeSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET(req: NextRequest) {
  const fail = (m: string) => NextResponse.redirect(new URL("/?auth=login&err=" + encodeURIComponent(m), req.url));
  const cfg = await getFacebookConfig();
  if (!cfg.enabled) return fail("Đăng nhập Facebook chưa được cấu hình");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get("fb_oauth_state")?.value;
  if (!code || !state || !savedState || state !== savedState) return fail("Phiên đăng nhập Facebook không hợp lệ, hãy thử lại");

  const redirectUri = new URL("/api/auth/facebook/callback", req.nextUrl.origin).toString();
  const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", cfg.appId);
  tokenUrl.searchParams.set("client_secret", cfg.appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);
  const tokenRes = await fetch(tokenUrl);
  if (!tokenRes.ok) return fail("Không đổi được mã đăng nhập Facebook");
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) return fail("Không lấy được thông tin tài khoản Facebook");
  const infoRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(token.access_token)}`);
  if (!infoRes.ok) return fail("Không lấy được thông tin tài khoản Facebook");
  const info = (await infoRes.json()) as { email?: string; name?: string };
  const email = (info.email ?? "").trim().toLowerCase();
  if (!email) return fail("Tài khoản Facebook chưa có email — hãy đăng ký bằng email");

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
  res.cookies.delete("fb_oauth_state");
  return res;
}
