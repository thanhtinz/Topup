import { prisma } from "./db";
import { notifyUser } from "./notify";
import { isMailConfigured, sendMail } from "./mailer";

export async function toggleWishlist(userId: number, target: { gameId?: number; packageId?: number }): Promise<boolean> {
  const where = target.packageId
    ? { userId_packageId: { userId, packageId: target.packageId } }
    : { userId_gameId: { userId, gameId: target.gameId! } };
  const existing = await prisma.wishlistItem.findUnique({ where });
  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    return false;
  }
  await prisma.wishlistItem.create({ data: { userId, gameId: target.gameId ?? null, packageId: target.packageId ?? null } });
  return true;
}

export async function wishlistGameIds(userId: number): Promise<Set<number>> {
  const rows = await prisma.wishlistItem.findMany({ where: { userId, gameId: { not: null } }, select: { gameId: true } });
  return new Set(rows.map((r) => r.gameId!));
}

export async function checkPriceAlerts(packageId: number, newPriceCents: number): Promise<number> {
  const alerts = await prisma.priceAlert.findMany({
    where: { packageId, active: true },
    include: { package: { select: { name: true, priceCents: true, game: { select: { name: true, slug: true } } } }, user: { select: { email: true, name: true } } },
  });
  let fired = 0;
  for (const a of alerts) {
    const hit = a.targetCents != null ? newPriceCents <= a.targetCents : newPriceCents < a.baselineCents;
    if (!hit) continue;
    const gameName = a.package.game.name;
    const title = `Giá ${a.package.name} (${gameName}) vừa giảm`;
    const body = `Gói bạn theo dõi đã giảm từ $${(a.baselineCents / 100).toFixed(2)} xuống $${(newPriceCents / 100).toFixed(2)}. Vào trang game để nạp ngay.`;
    await prisma.priceAlert.update({ where: { id: a.id }, data: { active: false, triggeredAt: new Date() } });
    await notifyUser(a.userId, "SYSTEM", title, body, `/game/${a.package.game.slug}`).catch(() => null);
    if (await isMailConfigured().catch(() => false)) {
      await sendMail(a.user.email, title, `<p>Xin chào ${a.user.name || "bạn"},</p><p>${body}</p><p>— BNTGame</p>`).catch(() => false);
    }
    fired++;
  }
  return fired;
}

export async function toggleGameNotify(userId: number, gameId: number): Promise<boolean> {
  const existing = await prisma.gameNotifySub.findUnique({ where: { userId_gameId: { userId, gameId } } });
  if (existing) {
    await prisma.gameNotifySub.delete({ where: { id: existing.id } });
    return false;
  }
  await prisma.gameNotifySub.create({ data: { userId, gameId } });
  return true;
}

export async function checkGamePriceDrop(gameId: number, packageName: string, oldPriceCents: number, newPriceCents: number): Promise<number> {
  if (newPriceCents >= oldPriceCents) return 0;
  const subs = await prisma.gameNotifySub.findMany({
    where: { gameId },
    include: { game: { select: { name: true, slug: true } }, user: { select: { email: true, name: true } } },
  });
  if (!subs.length) return 0;
  const since = new Date(Date.now() - 6 * 3600 * 1000);
  let fired = 0;
  for (const s of subs) {
    const title = `Giá ${s.game.name} vừa giảm`;
    const recent = await prisma.notification.findFirst({
      where: { userId: s.userId, title, createdAt: { gte: since } },
      select: { id: true },
    });
    if (recent) continue;
    const body = `Gói ${packageName} của ${s.game.name} đã giảm từ $${(oldPriceCents / 100).toFixed(2)} xuống $${(newPriceCents / 100).toFixed(2)}. Vào trang game để xem các gói đang giảm.`;
    await notifyUser(s.userId, "SYSTEM", title, body, `/game/${s.game.slug}`).catch(() => null);
    if (await isMailConfigured().catch(() => false)) {
      await sendMail(s.user.email, title, `<p>Xin chào ${s.user.name || "bạn"},</p><p>${body}</p><p>— BNTGame</p>`).catch(() => false);
    }
    fired++;
  }
  return fired;
}

export type QuickTopup = {
  gameId: number;
  gameSlug: string;
  gameName: string;
  gameCover: string;
  packageId: number;
  packageName: string;
  priceCents: number;
  fields: Record<string, string>;
  lastAt: Date;
};

export async function quickTopups(userId: number, limit = 6): Promise<QuickTopup[]> {
  const orders = await prisma.order.findMany({
    where: { userId, status: "DELIVERED" },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { game: { select: { id: true, slug: true, name: true, cover: true } }, items: { include: { package: { select: { id: true, name: true, priceCents: true, active: true } } } } },
  });
  const seen = new Set<number>();
  const out: QuickTopup[] = [];
  for (const o of orders) {
    if (seen.has(o.gameId)) continue;
    const item = o.items[0];
    if (!item || !item.package.active) continue;
    seen.add(o.gameId);
    out.push({
      gameId: o.gameId,
      gameSlug: o.game.slug,
      gameName: o.game.name,
      gameCover: o.game.cover,
      packageId: item.package.id,
      packageName: item.package.name,
      priceCents: item.package.priceCents,
      fields: (item.fieldsJson && typeof item.fieldsJson === "object" ? (item.fieldsJson as Record<string, string>) : {}),
      lastAt: o.createdAt,
    });
    if (out.length >= limit) break;
  }
  return out;
}
