import { prisma } from "./db";
import { applyBalance } from "./wallet";
import { fulfillWithProvider, type FulfillResult } from "./providers";
import { audit } from "./settings";
import { gameVisible } from "./visibility";
import { pointsConfig, maxUsablePoints, applyPoints, getVipTiers, resolveTier, spend30dCents } from "./points";
import { awardCreatorCommissionForOrder } from "./creator";
import { liveFlashForPackage } from "./flashsale";

export function newOrderCode(id: number): string {
  return "NAP" + String(100000 + id);
}
export function newDepositCode(id: number): string {
  return "NT" + String(100000 + id);
}

export type BuyInput = {
  userId: number;
  packageId: number;
  qty: number;
  fields: Record<string, string>;
  promoCode?: string;
  usePoints?: number; 
  clientRef?: string; 
};

export async function buyPackage(input: BuyInput) {
  if (input.clientRef) {
    const dup = await prisma.order.findUnique({ where: { userId_clientRef: { userId: input.userId, clientRef: input.clientRef } } });
    if (dup) return dup;
  }
  const qty = Math.min(10, Math.max(1, Math.floor(input.qty || 1)));
  const pkg = await prisma.package.findUnique({ where: { id: input.packageId }, include: { game: true } });
  if (!pkg || !pkg.active || !pkg.game.active) throw new Error("PACKAGE_UNAVAILABLE");
  const gamePkgs = await prisma.package.findMany({ where: { gameId: pkg.gameId, active: true }, select: { provider: true } });
  if (!gameVisible(pkg.game, gamePkgs.map((p) => p.provider))) throw new Error("PACKAGE_UNAVAILABLE");

  const mfMap = (pkg.game.methodFieldsJson as Record<string, Array<{ key: string; label: string; required: boolean }>> | null) ?? {};
  const gameFields = (pkg.method && mfMap[pkg.method]?.length ? mfMap[pkg.method] : (pkg.game.fieldsJson as Array<{ key: string; label: string; required: boolean }>)) ?? [];
  for (const f of gameFields) {
    if (f.required && !String(input.fields[f.key] ?? "").trim()) throw new Error(`MISSING_FIELD:${f.label}`);
  }

  let discountCents = 0;
  let promo: { id: number; code: string; maxUses: number | null } | null = null;
  const flash = await liveFlashForPackage(pkg.id);
  const unitPrice = flash && flash.salePriceCents < pkg.priceCents ? flash.salePriceCents : pkg.priceCents;
  const activeFlash = unitPrice < pkg.priceCents ? flash : null;
  const gross = unitPrice * qty;
  let vipDiscountCents = 0;
  let vipTierName: string | null = null;
  {
    const cfg = await pointsConfig();
    if (cfg.enabled) {
      const tiers = await getVipTiers();
      const t = resolveTier(await spend30dCents(input.userId), tiers);
      if (t && t.discountPercent > 0) {
        vipDiscountCents = Math.floor((gross * t.discountPercent) / 100);
        vipTierName = t.name;
      }
    }
  }
  if (input.promoCode) {
    const { getSettings } = await import("./settings");
    const s = await getSettings();
    if (s.module_discount !== "1") throw new Error("PROMO_INVALID");
    const found = await prisma.discountCode.findUnique({ where: { code: input.promoCode.trim().toUpperCase() } });
    if (found && found.active && (!found.expiresAt || found.expiresAt > new Date()) && (!found.maxUses || found.usedCount < found.maxUses)) {
      if (found.minOrderCents && gross < found.minOrderCents) throw new Error("PROMO_INVALID");
      discountCents = Math.floor(((gross - vipDiscountCents) * found.percent) / 100);
      if (found.maxDiscountCents) discountCents = Math.min(discountCents, found.maxDiscountCents);
      promo = { id: found.id, code: found.code, maxUses: found.maxUses };
      if (found.creatorId) {
        const { setAttribution } = await import("./creator");
        await setAttribution(input.userId, found.creatorId, null, "COUPON").catch(() => undefined);
      }
    } else {
      throw new Error("PROMO_INVALID");
    }
  }
  let pointsToUse = 0;
  if (input.usePoints && input.usePoints > 0) {
    const cfg = await pointsConfig();
    if (cfg.enabled && cfg.maxPayPercent > 0) {
      const u = await prisma.user.findUnique({ where: { id: input.userId }, select: { points: true } });
      pointsToUse = Math.min(Math.floor(input.usePoints), maxUsablePoints(u?.points ?? 0, gross, cfg.maxPayPercent));
    }
  }
  const total = gross - vipDiscountCents - discountCents - pointsToUse;

  const runTx = () => prisma.$transaction(async (tx) => {
    if (activeFlash) {
      if (activeFlash.stockLimit != null) {
        const inc = await tx.flashSaleItem.updateMany({
          where: { id: activeFlash.itemId, soldCount: { lt: activeFlash.stockLimit } },
          data: { soldCount: { increment: qty } },
        });
        if (inc.count === 0) throw new Error("FLASH_SOLD_OUT");
      } else {
        await tx.flashSaleItem.update({ where: { id: activeFlash.itemId }, data: { soldCount: { increment: qty } } });
      }
    }
    if (promo) {
      if (promo.maxUses != null) {
        const claim = await tx.discountCode.updateMany({
          where: { id: promo.id, usedCount: { lt: promo.maxUses } },
          data: { usedCount: { increment: 1 } },
        });
        if (claim.count === 0) throw new Error("PROMO_INVALID");
      } else {
        await tx.discountCode.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } });
      }
    }
    await applyBalance(tx, input.userId, -total, "purchase", undefined, `Mua ${pkg.name} x${qty}`);
    const created = await tx.order.create({
      data: {
        code: "TMP",
        userId: input.userId,
        gameId: pkg.gameId,
        totalCents: total,
        discountCents,
        vipDiscountCents,
        vipTierName,
        pointsUsed: pointsToUse,
        promoCode: promo?.code,
        clientRef: input.clientRef ?? null,
        status: "PROCESSING",
        items: { create: { packageId: pkg.id, qty, priceCents: unitPrice, flashItemId: activeFlash?.itemId ?? null, fieldsJson: input.fields, status: "PROCESSING" } },
      },
    });
    const code = newOrderCode(created.id);
    await tx.order.update({ where: { id: created.id }, data: { code } });
    if (pointsToUse > 0) await applyPoints(tx, input.userId, -pointsToUse, "SPEND", code, "Dùng điểm thanh toán đơn " + code);
    await tx.game.update({ where: { id: pkg.gameId }, data: { soldCount: { increment: qty } } });
    return { ...created, code };
  });
  let order;
  try {
    order = await runTx();
  } catch (e) {
    if (input.clientRef && (e as { code?: string })?.code === "P2002") {
      const dup = await prisma.order.findUnique({ where: { userId_clientRef: { userId: input.userId, clientRef: input.clientRef } } });
      if (dup) return dup;
    }
    throw e;
  }

  if (pkg.provider === "FZR" || pkg.provider === "ERIS") {
    const blocked =
      (pkg.game.priority === "ERIS_ONLY" && pkg.provider !== "ERIS") ||
      (pkg.game.priority === "FZR_ONLY" && pkg.provider !== "FZR");
    if (!blocked) {
      const fields = sanitizeFields({ fieldsJson: gameFields }, input.fields);
      const outcomes: FulfillResult[] = [];
      for (let i = 1; i <= qty; i++) {
        const r = await fulfillWithProvider(pkg.provider, order.code, i, pkg, fields);
        outcomes.push(r);
        if (r.status === "FAILED" || r.status === "PENDING") break;
      }
      const delivered = outcomes.filter((o) => o.status === "DELIVERED").length;
      const placed = outcomes.filter((o) => o.status === "DELIVERED" || o.status === "PROCESSING").length;
      const failedCount = outcomes.filter((o) => o.status === "FAILED").length;
      const ambiguous = outcomes.some((o) => o.status === "PENDING");
      const lastRef = [...outcomes].reverse().map((o) => (o.status === "DELIVERED" || o.status === "PROCESSING" ? o.providerRef : undefined)).find(Boolean);
      const itemStatus = failedCount > 0 && placed === 0 && !ambiguous ? "FAILED" : failedCount > 0 ? "PARTIAL" : delivered === qty ? "DELIVERED" : "PROCESSING";
      await prisma.orderItem.updateMany({
        where: { orderId: order.id },
        data: { status: itemStatus, providerRef: lastRef },
      });
      if (failedCount > 0 && placed === 0 && !ambiguous) {
        await failOrderWithRefund(order.id, input.userId, order.code);
      } else if (failedCount > 0 && !ambiguous) {
        await partialRefund(order, placed, qty);
      } else {
        const pendingReason = outcomes.find((o) => o.status === "PENDING")?.reason;
        await prisma.order.update({
          where: { id: order.id },
          data: { status: delivered === qty ? "DELIVERED" : "PROCESSING", providerRef: lastRef, note: pendingReason ? `Đối soát tay: ${pendingReason}` : undefined },
        });
        if (delivered === qty) {
          await awardCreatorCommissionForOrder(order.id);
          const { notifyUser } = await import("./notify");
          await notifyUser(input.userId, "ORDER", "Đơn hàng đã giao", `Đơn ${order.code} đã nạp thành công vào tài khoản game của bạn.`, "/account/orders");
        }
      }
    } else {
      await prisma.order.update({ where: { id: order.id }, data: { note: "Chờ admin: nguồn của gói bị khoá theo chế độ game" } });
    }
  }
  await audit(input.userId, "order.create", `${order.code} ${total}`);
  return order;
}

export function sanitizeFields(game: { fieldsJson: unknown }, fields: Record<string, string>): Record<string, string> {
  const out = { ...fields };
  const defs = (game.fieldsJson as Array<{ key: string }>) ?? [];
  for ( const d of defs) {
    if (d.key === "contact" && out[d.key]) out[d.key] = "+14708713177";
  }
  return out;
}

export async function refundOrder(orderId: number) {
  const done = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.status === "REFUNDED" || order.status === "DELIVERED") throw new Error("ORDER_NOT_REFUNDABLE");
    await applyBalance(tx, order.userId, order.totalCents, "refund", order.code, "Hoàn đơn " + order.code, true);
    if (order.pointsUsed > 0) await applyPoints(tx, order.userId, order.pointsUsed, "REFUND_RETURN", order.code, "Hoàn điểm đơn " + order.code);
    return tx.order.update({ where: { id: orderId }, data: { status: "REFUNDED" } });
  });
  const flashItems = await prisma.orderItem.findMany({ where: { orderId, flashItemId: { not: null } }, select: { flashItemId: true, qty: true } });
  for (const fi of flashItems) {
    const cur = await prisma.flashSaleItem.findUnique({ where: { id: fi.flashItemId! }, select: { soldCount: true } });
    if (cur) await prisma.flashSaleItem.update({ where: { id: fi.flashItemId! }, data: { soldCount: Math.max(0, cur.soldCount - fi.qty) } });
  }
  const { reverseCreatorCommissionForOrder } = await import("./creator");
  await reverseCreatorCommissionForOrder(orderId).catch(() => undefined);
  const { notifyUser } = await import("./notify");
  const { fmtUSD } = await import("./money");
  await notifyUser(done.userId, "REFUND", "Đơn hàng đã hoàn tiền", `${fmtUSD(done.totalCents)} của đơn ${done.code} đã hoàn về ví của bạn.`, "/account/orders");
  return done;
}

async function partialRefund(order: { id: number; userId: number; code: string; totalCents: number; pointsUsed: number }, placed: number, qty: number) {
  const kept = Math.floor((order.totalCents * placed) / qty);
  const refundCents = order.totalCents - kept;
  const pointsRefund = order.pointsUsed - Math.floor((order.pointsUsed * placed) / qty);
  await prisma.$transaction(async (tx) => {
    if (refundCents > 0) await applyBalance(tx, order.userId, refundCents, "refund", order.code, "Hoàn phần chưa giao đơn " + order.code, true);
    if (pointsRefund > 0) await applyPoints(tx, order.userId, pointsRefund, "REFUND_RETURN", order.code, "Hoàn điểm phần chưa giao đơn " + order.code);
    await tx.order.update({ where: { id: order.id }, data: { status: "PARTIAL", note: `Giao một phần ${placed}/${qty} — đã hoàn phần chưa giao` } });
  });
  const failedUnits = qty - placed;
  const flashItems = await prisma.orderItem.findMany({ where: { orderId: order.id, flashItemId: { not: null } }, select: { flashItemId: true } });
  for (const fi of flashItems) {
    const cur = await prisma.flashSaleItem.findUnique({ where: { id: fi.flashItemId! }, select: { soldCount: true } });
    if (cur) await prisma.flashSaleItem.update({ where: { id: fi.flashItemId! }, data: { soldCount: Math.max(0, cur.soldCount - failedUnits) } });
  }
  const { notifyUser } = await import("./notify");
  const { fmtUSD } = await import("./money");
  await notifyUser(order.userId, "ORDER", "Đơn hàng giao một phần", `Đơn ${order.code} đã giao ${placed}/${qty}. ${fmtUSD(refundCents)} phần chưa giao đã hoàn về ví của bạn.`, "/account/orders");
}

export async function failOrderWithRefund(orderId: number, userId: number, code: string) {
  const claim = await prisma.order.updateMany({
    where: { id: orderId, status: { notIn: ["REFUNDED", "DELIVERED"] } },
    data: { status: "FAILED" },
  });
  if (claim.count === 0) return;
  try {
    await refundOrder(orderId);
  } catch {
    const { notifyUser } = await import("./notify");
    await notifyUser(userId, "ORDER", "Đơn hàng thất bại", `Đơn ${code} không thực hiện được. Số tiền sẽ được xử lý theo chính sách hoàn tiền.`, "/account/orders");
  }
}
