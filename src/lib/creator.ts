import { createHash } from "crypto";
import { prisma } from "./db";
import { getSettings } from "./settings";


export type CommissionGroup = "STEAM_TOPUP" | "TELEGRAM" | "STEAM_GIFT" | "TOPUP_FZR" | "TOPUP_ERIS" | "STANDARD";

export async function creatorConfig() {
  const s = await getSettings();
  const groupRate = (v: string | undefined): number | null => {
    if (v === undefined || v === "") return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(10000, Math.max(0, n)) : null;
  };
  return {
    enabled: s.module_creator !== "0",
    attributionDays: Math.min(365, Math.max(1, parseInt(s.creator_attribution_days || "30", 10) || 30)),
    holdDays: Math.min(90, Math.max(0, parseInt(s.creator_hold_days || "7", 10) || 0)),
    minWithdrawCents: Math.max(0, parseInt(s.creator_min_withdraw_cents || "2000", 10) || 0),
    maxLinks: Math.min(200, Math.max(1, parseInt(s.creator_max_links || "20", 10) || 20)),
    termsVersion: s.creator_terms_version || "1.0",
    rankingPublic: s.creator_ranking_public === "1",
    maxRateBps: Math.min(10000, Math.max(0, parseInt(s.creator_max_rate_bps || "1000", 10) || 1000)),
    groupRates: {
      STEAM_TOPUP: groupRate(s.creator_rate_steam_topup_bps),
      TELEGRAM: groupRate(s.creator_rate_telegram_bps),
      STEAM_GIFT: groupRate(s.creator_rate_steam_gift_bps),
      TOPUP_FZR: groupRate(s.creator_rate_topup_fzr_bps),
      TOPUP_ERIS: groupRate(s.creator_rate_topup_eris_bps),
      STANDARD: null,
    } as Record<CommissionGroup, number | null>,
  };
}

export function classifyCommissionGroup(gameSlug: string, provider: string | null | undefined): CommissionGroup {
  if (gameSlug === "steam-top-up") return "STEAM_TOPUP";
  if (gameSlug === "telegram") return "TELEGRAM";
  if (gameSlug === "steam-gift") return "STEAM_GIFT";
  if (provider === "FZR") return "TOPUP_FZR";
  if (provider === "ERIS") return "TOPUP_ERIS";
  return "STANDARD";
}

export async function ensureCreatorLevels() {
  const n = await prisma.creatorLevel.count();
  if (n > 0) return;
  await prisma.creatorLevel.createMany({
    data: [
      { name: "Starter", rateBps: 200, minRevenue30dCents: 0, color: "#8D867A", sort: 1 },
      { name: "Silver", rateBps: 300, minRevenue30dCents: 50000, color: "#9AA5B1", sort: 2 },
      { name: "Gold", rateBps: 500, minRevenue30dCents: 200000, color: "#D97706", sort: 3 },
      { name: "Diamond", rateBps: 700, minRevenue30dCents: 1000000, color: "#1FB6F2", sort: 4 },
    ],
  });
}

export function creatorCodeFromId(userId: number, name: string): string {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10);
  return `${base || "CREATOR"}${userId}`;
}

export async function getCreatorByUser(userId: number) {
  return prisma.creator.findUnique({ where: { userId }, include: { level: true } });
}

export async function getCreatorByCode(code: string) {
  return prisma.creator.findUnique({ where: { code: code.toUpperCase() }, include: { level: true } });
}

export async function recordClick(linkId: number, creatorId: number, visitorId: string, ip: string, userAgent: string) {
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const dup = await prisma.creatorClick.findFirst({
    where: { linkId, visitorId, createdAt: { gte: since } },
    select: { id: true },
  });
  if (dup) return false;
  const ipHash = ip ? createHash("sha256").update(`bntgame:${ip}`).digest("hex").slice(0, 32) : "";
  await prisma.creatorClick.create({ data: { linkId, creatorId, visitorId, ipHash, userAgent: userAgent.slice(0, 200) } });
  return true;
}

export async function setAttribution(userId: number, creatorId: number, linkId: number | null, source: "LINK" | "COUPON") {
  const cfg = await creatorConfig();
  const expiresAt = new Date(Date.now() + cfg.attributionDays * 24 * 3600 * 1000);
  await prisma.creatorAttribution.upsert({
    where: { userId },
    create: { userId, creatorId, linkId, source, expiresAt },
    update: { creatorId, linkId, source, expiresAt },
  });
}

export async function effectiveRateBps(creator: { id: number; customRateBps: number | null; level: { rateBps: number } | null }, at = new Date()) {
  const cfg = await creatorConfig();
  let rate = creator.customRateBps ?? creator.level?.rateBps ?? 0;
  let campaignId: number | null = null;
  const join = await prisma.creatorCampaignJoin.findFirst({
    where: {
      creatorId: creator.id,
      status: "APPROVED",
      campaign: { status: "ACTIVE", startAt: { lte: at }, endAt: { gte: at }, bonusBps: { gt: 0 } },
    },
    include: { campaign: { select: { id: true, bonusBps: true } } },
    orderBy: { campaign: { bonusBps: "desc" } },
  });
  if (join) {
    rate += join.campaign.bonusBps;
    campaignId = join.campaign.id;
  }
  return { rateBps: Math.min(cfg.maxRateBps, Math.max(0, rate)), campaignId };
}

export async function awardCreatorCommissionForOrder(orderId: number) {
  const cfg = await creatorConfig();
  if (!cfg.enabled) return;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, code: true, status: true, totalCents: true, userId: true, promoCode: true, gameId: true },
  });
  if (!order || order.status !== "DELIVERED") return;

  let creatorId: number | null = null;
  if (order.promoCode) {
    const dc = await prisma.discountCode.findUnique({ where: { code: order.promoCode }, select: { creatorId: true } });
    if (dc?.creatorId) creatorId = dc.creatorId;
  }
  if (!creatorId) {
    const att = await prisma.creatorAttribution.findUnique({ where: { userId: order.userId } });
    if (att && att.expiresAt > new Date()) creatorId = att.creatorId;
  }
  if (!creatorId) return;
  const creator = await prisma.creator.findUnique({ where: { id: creatorId }, include: { level: true } });
  if (!creator || creator.status !== "ACTIVE") return;
  if (creator.userId === order.userId) return; 

  const game = await prisma.game.findUnique({ where: { id: order.gameId }, select: { slug: true } });
  const item = await prisma.orderItem.findFirst({ where: { orderId: order.id }, select: { package: { select: { provider: true } } } });
  const group = classifyCommissionGroup(game?.slug ?? "", item?.package?.provider);
  const groupRate = cfg.groupRates[group];
  let rateBps: number;
  let campaignId: number | null = null;
  if (groupRate !== null) {
    rateBps = groupRate;
  } else {
    const eff = await effectiveRateBps(creator);
    rateBps = eff.rateBps;
    campaignId = eff.campaignId;
  }
  if (rateBps <= 0) return;
  const eligible = Math.max(0, order.totalCents);
  const amount = Math.floor((eligible * rateBps) / 10000);
  if (amount <= 0) return;
  const availableAt = new Date(Date.now() + cfg.holdDays * 24 * 3600 * 1000);
  try {
    await prisma.creatorCommission.create({
      data: { creatorId: creator.id, orderId: order.id, orderCode: order.code, campaignId, eligibleCents: eligible, rateBps, amountCents: amount, status: "PENDING", availableAt },
    });
    const { notifyUser } = await import("./notify");
    const { fmtUSD } = await import("./money");
    await notifyUser(creator.userId, "CREATOR", "Bạn có hoa hồng mới", `+${fmtUSD(amount)} hoa hồng từ đơn ${order.code} đang chờ xác nhận.`, "/creator/commissions");
  } catch (e) {
    if ((e as { code?: string })?.code !== "P2002") throw e; 
  }
  await refreshCreatorLevel(creator.id).catch(() => undefined);
}

export async function reverseCreatorCommissionForOrder(orderId: number, adminId?: number) {
  const c = await prisma.creatorCommission.findUnique({ where: { orderId } });
  if (!c || c.status === "REVERSED") return;
  await prisma.$transaction(async (tx) => {
    await tx.creatorCommission.update({ where: { id: c.id }, data: { status: "REVERSED" } });
    if (c.status === "PAID") {
      await tx.creatorAdjustment.create({
        data: { creatorId: c.creatorId, amountCents: -c.amountCents, reason: `Thu hồi hoa hồng đã trả của đơn ${c.orderCode} (đơn hoàn tiền)`, adminId: adminId ?? null },
      });
    }
  });
}

export async function releaseDueCommissions(creatorId?: number) {
  await prisma.creatorCommission.updateMany({
    where: { status: "PENDING", availableAt: { lte: new Date() }, ...(creatorId ? { creatorId } : {}) },
    data: { status: "AVAILABLE" },
  });
}

export async function creatorBalances(creatorId: number) {
  await releaseDueCommissions(creatorId);
  const [pendingAgg, availAgg, paidAgg, openPayoutAgg, adjAgg] = await Promise.all([
    prisma.creatorCommission.aggregate({ where: { creatorId, status: "PENDING" }, _sum: { amountCents: true } }),
    prisma.creatorCommission.aggregate({ where: { creatorId, status: "AVAILABLE" }, _sum: { amountCents: true } }),
    prisma.creatorCommission.aggregate({ where: { creatorId, status: "PAID" }, _sum: { amountCents: true } }),
    prisma.creatorPayout.aggregate({ where: { creatorId, status: { in: ["PENDING", "APPROVED", "PROCESSING"] } }, _sum: { amountCents: true } }),
    prisma.creatorAdjustment.aggregate({ where: { creatorId }, _sum: { amountCents: true } }),
  ]);
  const paidOutAgg = await prisma.creatorPayout.aggregate({ where: { creatorId, status: "PAID" }, _sum: { amountCents: true } });
  const locked = openPayoutAgg._sum.amountCents ?? 0;
  const available = (availAgg._sum.amountCents ?? 0) + (adjAgg._sum.amountCents ?? 0) - locked;
  return {
    pendingCents: pendingAgg._sum.amountCents ?? 0,
    availableCents: available,
    lockedCents: locked,
    paidCommissionCents: paidAgg._sum.amountCents ?? 0,
    paidOutCents: paidOutAgg._sum.amountCents ?? 0,
  };
}

export async function requestPayout(userId: number, amountCents: number, method: string, destination: string) {
  const cfg = await creatorConfig();
  if (!cfg.enabled) throw new Error("CREATOR_DISABLED");
  const creator = await getCreatorByUser(userId);
  if (!creator) throw new Error("NOT_CREATOR");
  if (creator.status !== "ACTIVE") throw new Error("CREATOR_SUSPENDED");
  if (!creator.agreementAt) throw new Error("CREATOR_TERMS_REQUIRED");
  if (!["USDT", "BANK"].includes(method)) throw new Error("PAYOUT_INVALID");
  if (!destination || destination.trim().length < 4) throw new Error("PAYOUT_INVALID");
  if (!Number.isFinite(amountCents) || amountCents <= 0) throw new Error("PAYOUT_INVALID");
  if (amountCents < cfg.minWithdrawCents) throw new Error("PAYOUT_BELOW_MIN");
  const bal = await creatorBalances(creator.id);
  if (amountCents > bal.availableCents) throw new Error("PAYOUT_INSUFFICIENT");
  return prisma.creatorPayout.create({
    data: { creatorId: creator.id, amountCents, method, destination: destination.trim().slice(0, 190), status: "PENDING" },
  });
}

export async function markPayoutPaid(payoutId: number, txRef: string, adminId: number) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.creatorPayout.findUnique({ where: { id: payoutId } });
    if (!p) throw new Error("PAYOUT_NOT_FOUND");
    if (p.status === "PAID") return p;
    if (p.status === "REJECTED" || p.status === "FAILED") throw new Error("PAYOUT_CLOSED");
    let remaining = p.amountCents;
    const avail = await tx.creatorCommission.findMany({
      where: { creatorId: p.creatorId, status: "AVAILABLE" },
      orderBy: { createdAt: "asc" },
      select: { id: true, amountCents: true },
    });
    for (const c of avail) {
      if (remaining <= 0) break;
      if (c.amountCents <= remaining) {
        await tx.creatorCommission.update({ where: { id: c.id }, data: { status: "PAID" } });
        remaining -= c.amountCents;
      }
      // Khoản lớn hơn phần còn lại: giữ AVAILABLE (không tách khoản trong v1);
      // phần lẻ còn lại coi như đã trả từ điều chỉnh/dư — vẫn đánh dấu payout PAID.
    }
    const updated = await tx.creatorPayout.update({
      where: { id: payoutId },
      data: { status: "PAID", txRef: txRef.slice(0, 120), reviewedById: adminId, processedAt: new Date() },
    });
    const creator = await tx.creator.findUnique({ where: { id: p.creatorId }, select: { userId: true } });
    if (creator) {
      const { notifyUser } = await import("./notify");
      const { fmtUSD } = await import("./money");
      await notifyUser(creator.userId, "CREATOR", "Yêu cầu rút tiền đã thanh toán", `${fmtUSD(p.amountCents)} đã được thanh toán qua ${p.method}. Mã giao dịch: ${txRef || "—"}.`, "/creator/payouts", tx as never);
    }
    return updated;
  });
}

export async function creatorRevenue30d(creatorId: number) {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const agg = await prisma.creatorCommission.aggregate({
    where: { creatorId, status: { not: "REVERSED" }, createdAt: { gte: since } },
    _sum: { eligibleCents: true },
  });
  return agg._sum.eligibleCents ?? 0;
}

export async function refreshCreatorLevel(creatorId: number) {
  await ensureCreatorLevels();
  const revenue = await creatorRevenue30d(creatorId);
  const levels = await prisma.creatorLevel.findMany({ orderBy: { minRevenue30dCents: "desc" } });
  const target = levels.find((l) => revenue >= l.minRevenue30dCents) ?? levels[levels.length - 1];
  if (!target) return;
  const c = await prisma.creator.findUnique({ where: { id: creatorId }, select: { levelId: true, userId: true } });
  if (c && c.levelId !== target.id) {
    await prisma.creator.update({ where: { id: creatorId }, data: { levelId: target.id } });
    if (c.levelId !== null) {
      const { notifyUser } = await import("./notify");
      await notifyUser(c.userId, "CREATOR", "Bạn đã lên cấp Affiliate", `Chúc mừng! Bạn đạt cấp ${target.name} với tỉ lệ hoa hồng mới.`, "/creator/dashboard");
    }
  }
}

export async function creatorStats(creatorId: number, days = 30) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const [clicks, commissions, ordersCount] = await Promise.all([
    prisma.creatorClick.count({ where: { creatorId, createdAt: { gte: since } } }),
    prisma.creatorCommission.findMany({
      where: { creatorId, status: { not: "REVERSED" }, createdAt: { gte: since } },
      select: { eligibleCents: true, amountCents: true, orderId: true },
    }),
    prisma.creatorCommission.count({ where: { creatorId, status: { not: "REVERSED" }, createdAt: { gte: since } } }),
  ]);
  const revenue = commissions.reduce((a, c) => a + c.eligibleCents, 0);
  const commission = commissions.reduce((a, c) => a + c.amountCents, 0);
  return {
    clicks,
    orders: ordersCount,
    revenueCents: revenue,
    commissionCents: commission,
    conversionRate: clicks > 0 ? (ordersCount / clicks) * 100 : 0,
  };
}


export async function ensureLegacyCreator(userId: number) {
  const existing = await prisma.creator.findUnique({ where: { userId } });
  if (existing) return existing;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
  if (!user) return null;
  await ensureCreatorLevels();
  const starter = await prisma.creatorLevel.findFirst({ orderBy: { sort: "asc" } });
  const code = creatorCodeFromId(user.id, user.name || "CREATOR");
  const creator = await prisma.creator.create({
    data: { userId: user.id, code, displayName: user.name || user.email, levelId: starter?.id, agreementVersion: "", agreementAt: null },
  });
  await prisma.creatorLink.create({ data: { creatorId: creator.id, code: creator.code, name: "Link mặc định", destination: "/" } });
  await prisma.creatorLink.create({ data: { creatorId: creator.id, code: `KH${user.id}`, name: "Link giới thiệu cũ (KH)", destination: "/" } });
  return creator;
}

export async function runCreatorMigration(): Promise<{ migrated: number; movedCents: number }> {
  const { getSettings, setSetting } = await import("./settings");
  const s = await getSettings();
  if (s.creator_migration_v1) return { migrated: 0, movedCents: 0 };
  const [referrers, withHistory, withBalance] = await Promise.all([
    prisma.user.findMany({ where: { referrals: { some: {} } }, select: { id: true } }),
    prisma.affiliateTxn.findMany({ select: { userId: true }, distinct: ["userId"] }),
    prisma.user.findMany({ where: { OR: [{ affiliateBalanceCents: { gt: 0 } }, { affiliateEarnedCents: { gt: 0 } }] }, select: { id: true } }),
  ]);
  const ids = new Set<number>([...referrers.map((u) => u.id), ...withHistory.map((t) => t.userId), ...withBalance.map((u) => u.id)]);
  let movedCents = 0;
  for (const userId of ids) {
    const creator = await ensureLegacyCreator(userId);
    if (!creator) continue;
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { affiliateBalanceCents: true } });
    const bal = u?.affiliateBalanceCents ?? 0;
    if (bal > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.creatorAdjustment.create({
          data: { creatorId: creator.id, amountCents: bal, reason: "Chuyển số dư hoa hồng giới thiệu cũ sang ví Creator (migration v1)" },
        });
        await tx.affiliateTxn.create({
          data: { userId, kind: "MIGRATE", amountCents: bal, ref: `creator-migration-v1:${userId}`, note: "Chuyển sang ví Creator — giữ nguyên giá trị" },
        });
        await tx.user.update({ where: { id: userId }, data: { affiliateBalanceCents: 0 } });
      });
      movedCents += bal;
    }
  }
  await setSetting("creator_migration_v1", new Date().toISOString());
  return { migrated: ids.size, movedCents };
}


export interface PartnerCreator {
  id: number;
  displayName: string;
  code: string;
  tier: string;
  levelName: string;
  avatarUrl: string;
  channels: Array<{ platform: string; channelName: string; url: string }>;
}

export async function getPartnerCreators(limit?: number): Promise<PartnerCreator[]> {
  const creators = await prisma.creator.findMany({
    where: { status: "ACTIVE" },
    include: { level: true, channels: { orderBy: { id: "asc" } } },
  });
  if (!creators.length) return [];
  const since = new Date(Date.now() - 30 * 86400_000);
  const rev30 = await prisma.creatorCommission.groupBy({
    by: ["creatorId"],
    where: { status: { not: "REVERSED" }, createdAt: { gte: since } },
    _sum: { eligibleCents: true },
  });
  const revAll = await prisma.creatorCommission.groupBy({
    by: ["creatorId"],
    where: { status: { not: "REVERSED" } },
    _sum: { eligibleCents: true },
  });
  const m30 = new Map(rev30.map((r) => [r.creatorId, r._sum.eligibleCents ?? 0]));
  const mAll = new Map(revAll.map((r) => [r.creatorId, r._sum.eligibleCents ?? 0]));
  const sorted = [...creators].sort((a, b) =>
    (m30.get(b.id) ?? 0) - (m30.get(a.id) ?? 0) ||
    (mAll.get(b.id) ?? 0) - (mAll.get(a.id) ?? 0) ||
    a.createdAt.getTime() - b.createdAt.getTime());
  const picked = typeof limit === "number" ? sorted.slice(0, limit) : sorted;
  return picked.map((c) => ({
    id: c.id,
    displayName: c.displayName,
    code: c.code,
    tier: c.tier,
    avatarUrl: c.avatarUrl ?? "",
    levelName: c.level?.name ?? "",
    channels: c.channels.map((ch) => ({ platform: ch.platform, channelName: ch.channelName, url: ch.url })),
  }));
}
