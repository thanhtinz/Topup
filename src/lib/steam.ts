import { prisma } from "./db";
import { getSettings, audit } from "./settings";
import { applyBalance } from "./wallet";
import { fulfillSteamTopup } from "./providers";
import { newOrderCode } from "./orders";

export const STEAM_SLUG = "steam-top-up";
export const STEAM_NAME = "Steam Top-Up (CIS)";
export const STEAM_COVER = "/uploads/steam-cover.jpg";
const STEAM_EXTERNAL_ID = "steam_topup::1";

export type SteamConfig = {
  enabled: boolean;
  markupPct: number;
  discountPct: number;
  receiveRateVnd: number; 
  minCents: number;
  maxCents: number;
  unitPriceCents: number; 
  unitCostCents: number; 
};

export async function steamConfig(): Promise<SteamConfig> {
  const s = await getSettings();
  const markupPct = Math.min(100, Math.max(-50, parseFloat(s.steam_markup_percent) || 0));
  const discountPct = Math.min(99, Math.max(0, parseFloat(s.steam_discount_percent) || 0));
  const minUsd = parseFloat(s.steam_min_usd) || 0.1;
  const maxUsd = parseFloat(s.steam_max_usd) || 1000;
  const costBase = 100 * (1 - discountPct / 100);
  const directCents = parseInt(s.steam_unit_price_cents, 10);
  const unitPriceCents = Number.isFinite(directCents) && directCents > 0
    ? directCents
    : Math.ceil(costBase * (1 + markupPct / 100));
  return {
    enabled: s.module_steam === "1",
    markupPct,
    discountPct,
    receiveRateVnd: Math.max(0, parseInt(s.steam_receive_rate_vnd, 10) || 26000),
    minCents: Math.max(1, Math.round(minUsd * 100)),
    maxCents: Math.max(1, Math.round(maxUsd * 100)),
    unitPriceCents,
    unitCostCents: Math.ceil(costBase),
  };
}

export async function ensureSteamCatalog() {
  const cfg = await steamConfig();
  const game = await prisma.game.upsert({
    where: { slug: STEAM_SLUG },
    create: {
      name: STEAM_NAME,
      slug: STEAM_SLUG,
      cover: STEAM_COVER,
      genre: "",
      description:
        "Nạp tiền vào ví Steam (khu vực CIS) bằng tên đăng nhập Steam. Nhập số tiền USD cần nạp — được lẻ tới cent, ví dụ 10.50 — tiền vào ví Steam đúng số tiền bạn nhập. Nhập sai tên đăng nhập sẽ nạp nhầm vào tài khoản của người khác, hãy kiểm tra kỹ trước khi thanh toán.",
      regions: ["CIS"],
      fieldsJson: [{ key: "steamLogin", label: "Steam login", required: true, placeholder: "Tên đăng nhập Steam" }],
      compareApproved: true,
      priority: "FZR",
      active: true,
    },
    update: {},
  });
  const pkg = await prisma.package.findFirst({ where: { gameId: game.id, externalId: STEAM_EXTERNAL_ID } });
  if (pkg) {
    await prisma.package.update({
      where: { id: pkg.id },
      data: { priceCents: cfg.unitPriceCents, costCents: cfg.unitCostCents, active: true, provider: "FZR" },
    });
    return { game, pkg: { ...pkg, priceCents: cfg.unitPriceCents, costCents: cfg.unitCostCents } };
  }
  const created = await prisma.package.create({
    data: {
      gameId: game.id,
      name: "1 USD",
      region: "CIS",
      method: "Login",
      costCents: cfg.unitCostCents,
      priceCents: cfg.unitPriceCents,
      provider: "FZR",
      externalId: STEAM_EXTERNAL_ID,
      active: true,
    },
  });
  return { game, pkg: created };
}

export async function buySteamTopup(input: { userId: number; login: string; amountCents: number }) {
  const cfg = await steamConfig();
  if (!cfg.enabled) throw new Error("STEAM_UNAVAILABLE");
  const login = input.login.trim().slice(0, 64);
  if (!login) throw new Error("STEAM_LOGIN_REQUIRED");
  if (!Number.isInteger(input.amountCents) || input.amountCents < cfg.minCents || input.amountCents > cfg.maxCents) {
    throw new Error("STEAM_AMOUNT_INVALID");
  }
  const { game, pkg } = await ensureSteamCatalog();
  if (!game.active || !pkg.active) throw new Error("STEAM_UNAVAILABLE");
  const gross = Math.ceil((cfg.unitPriceCents * input.amountCents) / 100);
  const amountUsd = (input.amountCents / 100).toFixed(2);

  const order = await prisma.$transaction(async (tx) => {
    await applyBalance(tx, input.userId, -gross, "purchase", undefined, `Nạp Steam ${amountUsd} USD`);
    const created = await tx.order.create({
      data: {
        code: "TMP",
        userId: input.userId,
        gameId: game.id,
        totalCents: gross,
        status: "PROCESSING",
        items: {
          create: {
            packageId: pkg.id,
            qty: 1,
            priceCents: gross,
            fieldsJson: { steamLogin: login, amountUsd, unitPriceCents: cfg.unitPriceCents },
            status: "PROCESSING",
          },
        },
      },
    });
    const code = newOrderCode(created.id);
    await tx.order.update({ where: { id: created.id }, data: { code } });
    await tx.game.update({ where: { id: game.id }, data: { soldCount: { increment: 1 } } });
    return { ...created, code };
  });

  const result = await fulfillSteamTopup(order.code, 1, login, input.amountCents);
  await prisma.orderItem.updateMany({
    where: { orderId: order.id },
    data: { status: result.status === "DELIVERED" ? "DELIVERED" : result.status === "FAILED" ? "FAILED" : "PROCESSING", providerRef: "providerRef" in result ? result.providerRef : undefined },
  });
  await prisma.order.update({
    where: { id: order.id },
    data: { status: result.status === "DELIVERED" ? "DELIVERED" : "PROCESSING", providerRef: "providerRef" in result ? result.providerRef : undefined, note: result.status === "PENDING" ? `Đối soát tay: ${result.reason}` : undefined },
  });
  const { notifyUser } = await import("./notify");
  if (result.status === "DELIVERED") {
    const { awardCreatorCommissionForOrder } = await import("./creator");
    await awardCreatorCommissionForOrder(order.id);
    await notifyUser(input.userId, "ORDER", "Đơn hàng đã giao", `Đơn ${order.code} đã nạp thành công vào tài khoản Steam của bạn.`, "/account/orders");
  } else if (result.status === "FAILED") {
    await notifyUser(input.userId, "ORDER", "Đơn hàng thất bại", `Đơn ${order.code} không nạp được. Số tiền sẽ được xử lý theo chính sách hoàn tiền.`, "/account/orders");
  }
  await audit(input.userId, "order.create", `${order.code} STEAM ${amountUsd} USD ${gross}`);
  return order;
}
