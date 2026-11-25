import { prisma } from "./db";
import { fulfillWithProvider, fulfillSteamTopup, fulfillSteamGift, fulfillTelegramStars, fulfillTelegramPremium, type FulfillResult } from "./providers";
import { failOrderWithRefund, partialRefund, sanitizeFields } from "./orders";

export type RecoverySummary = {
  scanned: number;
  delivered: number;
  refunded: number;
  partial: number;
  stillProcessing: number;
  escalated: number;
  skipped: number;
};

const STUCK_MS = 15 * 60 * 1000;
const ESCALATE_MS = 48 * 3600 * 1000;
const ERIS_ESCALATE_MS = 24 * 3600 * 1000;
const ESCALATED_MARK = "[RECOVERY_ESCALATED]";

type OrderWithItems = Awaited<ReturnType<typeof findStuck>>[number];

async function findStuck() {
  const cutoff = new Date(Date.now() - STUCK_MS);
  return prisma.order.findMany({
    where: { status: "PROCESSING", updatedAt: { lt: cutoff } },
    orderBy: { updatedAt: "asc" },
    take: 20,
    include: {
      items: { include: { package: { select: { provider: true, externalId: true, method: true } } } },
      game: { select: { fieldsJson: true, methodFieldsJson: true } },
    },
  });
}

async function escalate(order: { id: number; code: string; userId: number; note: string | null }, reason: string): Promise<boolean> {
  if (order.note?.includes(ESCALATED_MARK)) return false;
  await prisma.order.update({
    where: { id: order.id },
    data: { note: `${order.note ? order.note + " " : ""}${ESCALATED_MARK} ${reason}` },
  });
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  const { notifyUser } = await import("./notify");
  for (const a of admins) {
    await notifyUser(a.id, "ORDER", "Đơn kẹt cần đối soát tay", `Đơn ${order.code} vẫn ở trạng thái đang xử lý quá lâu — ${reason}. Kiểm tra ở Admin → Đơn hàng.`, "/admin/orders").catch(() => undefined);
  }
  return true;
}

async function markDelivered(order: { id: number; userId: number; code: string }, providerRef?: string): Promise<void> {
  const claim = await prisma.order.updateMany({
    where: { id: order.id, status: "PROCESSING" },
    data: { status: "DELIVERED", providerRef },
  });
  if (claim.count === 0) return;
  await prisma.orderItem.updateMany({ where: { orderId: order.id }, data: { status: "DELIVERED", providerRef } });
  const { awardCreatorCommissionForOrder } = await import("./creator");
  await awardCreatorCommissionForOrder(order.id).catch(() => undefined);
  const { notifyUser } = await import("./notify");
  await notifyUser(order.userId, "ORDER", "Đơn hàng đã giao", `Đơn ${order.code} đã hoàn tất thành công.`, "/account/orders").catch(() => undefined);
}

function lastRef(outcomes: FulfillResult[]): string | undefined {
  return [...outcomes].reverse().map((o) => (o.status === "DELIVERED" || o.status === "PROCESSING" ? o.providerRef : undefined)).find(Boolean);
}

async function settleMultiUnit(
  order: OrderWithItems,
  outcomes: FulfillResult[],
  qty: number,
  opts: { refundPartial: boolean },
): Promise<"delivered" | "refunded" | "partial" | "processing"> {
  const delivered = outcomes.filter((o) => o.status === "DELIVERED").length;
  const placed = outcomes.filter((o) => o.status === "DELIVERED" || o.status === "PROCESSING").length;
  const failed = outcomes.filter((o) => o.status === "FAILED").length;
  const ambiguous = outcomes.some((o) => o.status === "PENDING");
  const ref = lastRef(outcomes);
  const itemStatus = failed > 0 && placed === 0 && !ambiguous ? "FAILED" : failed > 0 ? "PARTIAL" : delivered === qty ? "DELIVERED" : "PROCESSING";
  await prisma.orderItem.updateMany({ where: { orderId: order.id }, data: { status: itemStatus, providerRef: ref } });
  if (failed > 0 && placed === 0 && !ambiguous) {
    await failOrderWithRefund(order.id, order.userId, order.code);
    return "refunded";
  }
  if (failed > 0 && !ambiguous && opts.refundPartial) {
    await partialRefund({ id: order.id, userId: order.userId, code: order.code, totalCents: order.totalCents, pointsUsed: order.pointsUsed }, placed, qty);
    return "partial";
  }
  if (failed === 0 && delivered === qty) {
    await markDelivered(order, ref);
    return "delivered";
  }
  const pendingReason = outcomes.find((o) => o.status === "PENDING")?.reason;
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "PROCESSING", providerRef: ref, note: pendingReason ? `Đối soát tay: ${pendingReason}` : failed > 0 ? `Đối soát tay: giao một phần ${placed}/${qty}` : order.note ?? undefined },
  });
  return "processing";
}

async function settleSingle(
  order: OrderWithItems,
  result: FulfillResult,
): Promise<"delivered" | "refunded" | "processing"> {
  await prisma.orderItem.updateMany({
    where: { orderId: order.id },
    data: { status: result.status === "DELIVERED" ? "DELIVERED" : result.status === "FAILED" ? "FAILED" : "PROCESSING", providerRef: "providerRef" in result ? result.providerRef : undefined },
  });
  if (result.status === "FAILED") {
    await failOrderWithRefund(order.id, order.userId, order.code);
    return "refunded";
  }
  if (result.status === "DELIVERED") {
    await markDelivered(order, "providerRef" in result ? result.providerRef : undefined);
    return "delivered";
  }
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "PROCESSING", providerRef: "providerRef" in result ? result.providerRef : undefined, note: result.status === "PENDING" ? `Đối soát tay: ${result.reason}` : order.note ?? undefined },
  });
  return "processing";
}

export async function recoverStuckOrders(): Promise<RecoverySummary> {
  const summary: RecoverySummary = { scanned: 0, delivered: 0, refunded: 0, partial: 0, stillProcessing: 0, escalated: 0, skipped: 0 };
  const stuck = await findStuck();
  summary.scanned = stuck.length;
  for (const order of stuck) {
    const claim = await prisma.order.updateMany({
      where: { id: order.id, status: "PROCESSING", updatedAt: order.updatedAt },
      data: { updatedAt: new Date() },
    });
    if (claim.count === 0) {
      summary.skipped++;
      continue;
    }
    const item = order.items[0];
    if (!item) {
      summary.skipped++;
      continue;
    }
    const f = (item.fieldsJson ?? {}) as Record<string, unknown>;
    const ageMs = Date.now() - order.createdAt.getTime();
    let outcome: "delivered" | "refunded" | "partial" | "processing" | "manual" = "processing";

    if (typeof f.steamLogin === "string") {
      const amountCents = Math.round(parseFloat(String(f.amountUsd ?? "0")) * 100);
      const r = await fulfillSteamTopup(order.code, 1, f.steamLogin, amountCents);
      outcome = await settleSingle(order, r);
    } else if (typeof f.inviteUrl === "string") {
      const r = await fulfillSteamGift(order.code, 1, {
        inviteUrl: f.inviteUrl,
        subId: String(f.subId ?? ""),
        appId: Number(f.appid ?? 0),
        region: String(f.region ?? ""),
      });
      outcome = await settleSingle(order, r);
    } else if (f.kind === "stars" || f.kind === "premium") {
      const username = String(f.username ?? "");
      if (f.kind === "stars") {
        const r = await fulfillTelegramStars(order.code, 1, { username, quantity: Number(f.stars ?? 0) });
        outcome = await settleSingle(order, r);
      } else {
        const qty = Math.max(1, item.qty);
        const outcomes: FulfillResult[] = [];
        for (let i = 1; i <= qty; i++) {
          const r = await fulfillTelegramPremium(order.code, i, { username, months: Number(f.months ?? 0) });
          outcomes.push(r);
          if (r.status === "FAILED" || r.status === "PENDING") break;
        }
        outcome = await settleMultiUnit(order, outcomes, qty, { refundPartial: false });
      }
    } else if (item.package && (item.package.provider === "FZR" || item.package.provider === "ERIS")) {
      if (item.package.provider === "ERIS") {
        outcome = "manual";
      } else {
        const mfMap = (order.game?.methodFieldsJson as Record<string, Array<{ key: string; label: string; required: boolean }>> | null) ?? {};
        const gameFields = item.package.method && mfMap[item.package.method]?.length ? mfMap[item.package.method] : ((order.game?.fieldsJson as Array<{ key: string; label: string; required: boolean }>) ?? []);
        const fields = sanitizeFields({ fieldsJson: gameFields }, (item.fieldsJson ?? {}) as Record<string, string>);
        const qty = Math.max(1, item.qty);
        const outcomes: FulfillResult[] = [];
        for (let i = 1; i <= qty; i++) {
          const r = await fulfillWithProvider("FZR", order.code, i, { externalId: item.package.externalId }, fields);
          outcomes.push(r);
          if (r.status === "FAILED" || r.status === "PENDING") break;
        }
        outcome = await settleMultiUnit(order, outcomes, qty, { refundPartial: true });
      }
    } else {
      outcome = "manual";
    }

    if (outcome === "delivered") summary.delivered++;
    else if (outcome === "refunded") summary.refunded++;
    else if (outcome === "partial") summary.partial++;
    else summary.stillProcessing++;

    const isEris = item.package?.provider === "ERIS" && typeof f.steamLogin !== "string" && typeof f.inviteUrl !== "string" && f.kind === undefined;
    const escalateAfter = isEris ? ERIS_ESCALATE_MS : ESCALATE_MS;
    if ((outcome === "processing" || outcome === "manual") && ageMs > escalateAfter) {
      const fresh = await prisma.order.findUnique({ where: { id: order.id }, select: { note: true, status: true } });
      if (fresh?.status === "PROCESSING") {
        const did = await escalate({ id: order.id, code: order.code, userId: order.userId, note: fresh.note }, isEris ? "đơn qua nguồn không hỗ trợ phát lại tự động" : "quá 48 giờ chưa hoàn tất");
        if (did) summary.escalated++;
      }
    }
  }
  return summary;
}
