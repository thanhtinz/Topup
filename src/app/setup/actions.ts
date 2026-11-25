"use server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { makeSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { hasAdmin } from "@/lib/setup";

function backErr(msg: string): never {
  redirect("/setup?err=" + encodeURIComponent(msg));
}

export async function setupAdminAction(formData: FormData) {
  if (await hasAdmin()) backErr("Hệ thống đã được thiết lập rồi.");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (name.length < 2) backErr("Vui lòng nhập họ tên quản trị viên.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) backErr("Email không hợp lệ.");
  if (password.length < 10) backErr("Mật khẩu phải có ít nhất 10 ký tự.");
  if (password !== confirm) backErr("Mật khẩu nhập lại không khớp.");
  const existed = await prisma.user.findUnique({ where: { email } }).catch(() => null);
  if (existed) backErr("Email này đã có tài khoản — hãy dùng email khác.");
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: "ADMIN", active: true },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, makeSessionToken(user.id, user.role), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 24 * 3600,
  });
  redirect("/admin");
}
