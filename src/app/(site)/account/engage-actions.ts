"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { toggleWishlist, toggleGameNotify } from "@/lib/engage";

function back(path: string, msg?: string, err?: string): never {
  const q = err ? `?err=${encodeURIComponent(err)}` : msg ? `?msg=${encodeURIComponent(msg)}` : "";
  redirect(path + q);
}

const str = (fd: FormData, k: string, max = 300) => String(fd.get(k) ?? "").trim().slice(0, max);

export async function toggleWishlistAction(input: { gameId?: number; packageId?: number }): Promise<{ ok: boolean; wished: boolean }> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { ok: false, wished: false };
  const wished = await toggleWishlist(user.id, input);
  return { ok: true, wished };
}

export async function toggleGameNotifyAction(input: { gameId: number }): Promise<{ ok: boolean; subbed: boolean }> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { ok: false, subbed: false };
  const subbed = await toggleGameNotify(user.id, input.gameId);
  return { ok: true, subbed };
}

export async function removeGameNotifyAction(formData: FormData) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  const id = Number(formData.get("id"));
  await prisma.gameNotifySub.deleteMany({ where: { id, userId: user.id } });
  back("/account/alerts", "Đã tắt nhận thông báo của game");
}

export async function removeWishlistAction(formData: FormData) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  const id = Number(formData.get("id"));
  await prisma.wishlistItem.deleteMany({ where: { id, userId: user.id } });
  back("/account/wishlist", "Đã bỏ khỏi danh sách yêu thích");
}

export async function togglePriceAlertAction(input: { packageId: number }): Promise<{ ok: boolean; active: boolean }> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { ok: false, active: false };
  const pkg = await prisma.package.findUnique({ where: { id: input.packageId }, select: { id: true, priceCents: true, active: true } });
  if (!pkg || !pkg.active) return { ok: false, active: false };
  const existing = await prisma.priceAlert.findUnique({ where: { userId_packageId: { userId: user.id, packageId: pkg.id } } });
  if (existing?.active) {
    await prisma.priceAlert.update({ where: { id: existing.id }, data: { active: false } });
    return { ok: true, active: false };
  }
  await prisma.priceAlert.upsert({
    where: { userId_packageId: { userId: user.id, packageId: pkg.id } },
    create: { userId: user.id, packageId: pkg.id, baselineCents: pkg.priceCents, active: true },
    update: { baselineCents: pkg.priceCents, active: true, triggeredAt: null },
  });
  return { ok: true, active: true };
}

export async function deletePriceAlertAction(formData: FormData) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  const id = Number(formData.get("id"));
  await prisma.priceAlert.deleteMany({ where: { id, userId: user.id } });
  back("/account/alerts", "Đã xoá báo giá");
}

export async function reactivatePriceAlertAction(formData: FormData) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  const id = Number(formData.get("id"));
  const alert = await prisma.priceAlert.findFirst({ where: { id, userId: user.id }, include: { package: { select: { priceCents: true } } } });
  if (alert) {
    await prisma.priceAlert.update({ where: { id }, data: { active: true, baselineCents: alert.package.priceCents, triggeredAt: null } });
  }
  back("/account/alerts", "Đã bật lại báo giá theo giá hiện tại");
}

export async function markAllNotificationsReadAction() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  back("/account/notifications", "Đã đánh dấu tất cả là đã đọc");
}
