import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { verifySession, SESSION_COOKIE_NAME } from "./session";

export const SESSION_COOKIE = SESSION_COOKIE_NAME;

export async function getCurrentUser() {
  const store = await cookies();
  const sess = verifySession(store.get(SESSION_COOKIE)?.value);
  if (!sess) return null;
  const user = await prisma.user.findUnique({ where: { id: sess.userId } });
  if (!user || !user.active) return null;
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const path = (await headers()).get("x-pathname") ?? "";
    const next = path.startsWith("/account") ? "&next=" + encodeURIComponent(path) : "";
    redirect("/?auth=login" + next);
  }
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "ADMIN" && user.role !== "STAFF") redirect("/");
  return user;
}

export async function requireOwner() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "ADMIN") redirect("/admin");
  return user;
}
