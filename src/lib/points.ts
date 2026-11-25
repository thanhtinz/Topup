import { prisma } from "./db";
import { getSettings } from "./settings";


export type PointsConfig = {
  enabled: boolean;
  perReview: number;
  dailyCap: number;
  maxPayPercent: number;
  vipLateHours: number;
  vipLatePoints: number;
};

export async function pointsConfig(): Promise<PointsConfig> {
  const s = await getSettings();
  return {
    enabled: s.module_points === "1",
    perReview: Math.max(0, parseInt(s.points_per_review ?? "2", 10) || 0),
    dailyCap: Math.max(0, parseInt(s.points_daily_cap ?? "4", 10) || 0),
    maxPayPercent: Math.min(100, Math.max(0, parseInt(s.points_max_pay_percent ?? "5", 10) || 0)),
    vipLateHours: Math.max(1, parseInt(s.vip_late_hours ?? "24", 10) || 24),
    vipLatePoints: Math.max(0, parseInt(s.vip_late_points ?? "50", 10) || 0),
  };
}

export type VipTierRow = {
  id: number;
  name: string;
  thresholdCents: number;
  discountPercent: number;
  couponPercent: number;
  lateComp: boolean;
  iconUrl: string | null;
  sort: number;
};

export async function getVipTiers(): Promise<VipTierRow[]> {
  return prisma.vipTier.findMany({ orderBy: [{ thresholdCents: "asc" }, { sort: "asc" }] });
}

export function resolveTier(spendCents: number, tiers: VipTierRow[]): VipTierRow | null {
  let cur: VipTierRow | null = null;
  for (const t of tiers) if (spendCents >= t.thresholdCents) cur = t;
  return cur;
}

export async function userTier(userId: number): Promise<{ tier: VipTierRow | null; tiers: VipTierRow[]; spendCents: number }> {
  const [tiers, spendCents] = await Promise.all([getVipTiers(), spend30dCents(userId)]);
  return { tier: resolveTier(spendCents, tiers), tiers, spendCents };
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function applyPoints(tx: Tx, userId: number, delta: number, kind: string, ref?: string, note?: string) {
  if (delta === 0) return 0;
  const user = await tx.user.findUnique({ where: { id: userId }, select: { points: true } });
  if (!user) throw new Error("USER_NOT_FOUND");
  if (delta < 0 && user.points + delta < 0) throw new Error("POINTS_INSUFFICIENT");
  const updated = await tx.user.update({
    where: { id: userId },
    data: {
      points: { increment: delta },
      ...(delta > 0 && (kind === "EARN_REVIEW" || kind === "LATE_COMP") ? { pointsTotalEarned: { increment: delta } } : {}),
    },
  });
  await tx.pointTxn.create({
    data: { userId, delta, kind, ref, note, balanceAfter: updated.points },
  });
  return updated.points;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function awardReviewPoints(tx: Tx, userId: number, orderCode: string, cfg: PointsConfig): Promise<number> {
  if (!cfg.enabled || cfg.perReview <= 0 || cfg.dailyCap <= 0) return 0;
  const todayCount = await tx.pointTxn.count({
    where: { userId, kind: "EARN_REVIEW", createdAt: { gte: startOfToday() } },
  });
  if (todayCount >= cfg.dailyCap) return 0;
  await applyPoints(tx, userId, cfg.perReview, "EARN_REVIEW", orderCode, "Điểm đánh giá đơn hàng");
  return cfg.perReview;
}

export function maxUsablePoints(balance: number, grossCents: number, maxPayPercent: number): number {
  return Math.max(0, Math.min(balance, Math.floor((grossCents * maxPayPercent) / 100)));
}

export async function spend30dCents(userId: number): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const agg = await prisma.order.aggregate({
    where: { userId, createdAt: { gte: since }, status: { in: ["PENDING", "PROCESSING", "PARTIAL", "DELIVERED"] } },
    _sum: { totalCents: true },
  });
  return agg._sum.totalCents ?? 0;
}

export async function ensureMonthlyCoupon(userId: number, tier: VipTierRow | null, cfg: PointsConfig): Promise<string | null> {
  if (!cfg.enabled || !tier || tier.couponPercent <= 0) return null;
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const code = `VIP${userId}T${yyyymm}`;
  const existing = await prisma.discountCode.findUnique({ where: { code } });
  if (existing) return existing.active ? code : null;
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  await prisma.discountCode.create({
    data: { code, percent: tier.couponPercent, maxUses: 1, active: true, expiresAt: endOfMonth },
  });
  return code;
}

export async function checkLateCompensation(userId: number, tier: VipTierRow | null, cfg: PointsConfig): Promise<number> {
  if (!cfg.enabled || !tier?.lateComp || cfg.vipLatePoints <= 0) return 0;
  const orders = await prisma.order.findMany({
    where: { userId, status: "DELIVERED" },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { code: true, createdAt: true, updatedAt: true },
  });
  let credited = 0;
  for (const o of orders) {
    const hours = (o.updatedAt.getTime() - o.createdAt.getTime()) / 3600000;
    if (hours < cfg.vipLateHours) continue;
    const already = await prisma.pointTxn.findFirst({ where: { userId, kind: "LATE_COMP", ref: o.code } });
    if (already) continue;
    await prisma.$transaction(async (tx) => {
      await applyPoints(tx, userId, cfg.vipLatePoints, "LATE_COMP", o.code, `Bồi thường giao chậm đơn ${o.code}`);
    });
    credited += cfg.vipLatePoints;
  }
  return credited;
}
