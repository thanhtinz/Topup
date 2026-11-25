import { prisma } from "./db";
import { getSettings, setSetting, audit } from "./settings";
import { applyBalance } from "./wallet";
import { fzrGiftOffers, fzrGiftGamesList, fulfillSteamGift, type FzrGiftOffer } from "./providers";
import { newOrderCode } from "./orders";

export const GIFT_SLUG = "steam-gift";
export const GIFT_NAME = "Steam Gift Game";
export const GIFT_COVER = "/uploads/steam-gift-cover.jpg";
const GIFT_EXTERNAL_ID = "steam_gift::hub";

export function giftGameImage(appid: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

export type GiftConfig = {
  enabled: boolean;
  markupPct: number;
  discountPct: number; 
};

export async function giftConfig(): Promise<GiftConfig> {
  const s = await getSettings();
  return {
    enabled: s.module_steamgift === "1",
    markupPct: Math.min(100, Math.max(-50, parseFloat(s.steamgift_markup_percent) || 0)),
    discountPct: Math.min(99, Math.max(0, parseFloat(s.steam_discount_percent) || 0)),
  };
}

export function giftSellCents(priceUsd: number, markupPct: number): number {
  return Math.ceil(priceUsd * 100 * (1 + markupPct / 100));
}

export function giftCostCents(priceUsd: number, discountPct: number): number {
  return Math.ceil(priceUsd * 100 * (1 - discountPct / 100));
}

export type GiftOfferPriced = {
  subId: string;
  name: string;
  regions: { region: string; priceCents: number }[]; 
};

const offersCache = new Map<number, { at: number; val: GiftOfferPriced[] | null }>();
export async function giftOffersPriced(appid: number): Promise<GiftOfferPriced[] | null> {
  const hit = offersCache.get(appid);
  if (hit && Date.now() - hit.at < (hit.val ? 300_000 : 60_000)) return hit.val;
  let val: GiftOfferPriced[] | null = null;
  try {
    const cfg = await giftConfig();
    const raw = await fzrGiftOffers(appid);
    if (raw && raw.length) {
      val = raw.map((o: FzrGiftOffer) => ({
        subId: o.subId,
        name: o.name,
        regions: o.regions
          .map((r) => ({ region: r.region, priceCents: giftSellCents(r.priceUsd, cfg.markupPct) }))
          .sort((a, b) => a.priceCents - b.priceCents),
      }));
    }
  } catch { /* hiển thị — lỗi thì coi như chưa có offer */ }
  offersCache.set(appid, { at: Date.now(), val });
  return val;
}

export async function ensureGiftCatalog() {
  const game = await prisma.game.upsert({
    where: { slug: GIFT_SLUG },
    create: {
      name: GIFT_NAME,
      slug: GIFT_SLUG,
      cover: GIFT_COVER,
      genre: "",
      description:
        "Mua game Steam dạng quà tặng ở khu vực cửa hàng rẻ nhất — gửi thẳng vào tài khoản của bạn qua lời mời kết bạn Steam. Chọn game và phiên bản, chọn khu vực (khu vực rẻ nhất được gắn nhãn), dán link mời Steam của tài khoản nhận — quà được gửi tự động. Lưu ý: quà khoá khu vực, chỉ tài khoản Steam thuộc khu vực đã chọn mới nhận được.",
      regions: ["Global"],
      fieldsJson: [{ key: "inviteUrl", label: "Link mời Steam", required: true, placeholder: "Dán link ngắn s.team/p/p/..." }],
      compareApproved: true,
      priority: "FZR",
      active: true,
    },
    update: {},
  });
  const pkg = await prisma.package.findFirst({ where: { gameId: game.id, externalId: GIFT_EXTERNAL_ID } });
  if (pkg) return { game, pkg };
  const created = await prisma.package.create({
    data: {
      gameId: game.id,
      name: "Steam Gift",
      region: "Global",
      method: "Login",
      costCents: 0,
      priceCents: 0,
      provider: "FZR",
      externalId: GIFT_EXTERNAL_ID,
      active: true,
    },
  });
  return { game, pkg: created };
}

export async function syncGiftCatalog(
  onProgress?: (p: { phase: string; done: number; total: number }) => void,
): Promise<{ count: number; total: number }> {
  onProgress?.({ phase: "Đang lấy danh sách game từ FZR...", done: 0, total: 0 });
  const { games, total } = await fzrGiftGamesList(200000);
  if (!games.length) throw new Error("FZR_GIFT_LIST_EMPTY");
  const seen = new Set<number>();
  const rows = games.filter((g) => (seen.has(g.appid) ? false : (seen.add(g.appid), true)));
  const startedAt = new Date();
  const BATCH = 2000;
  onProgress?.({ phase: "Đang ghi danh mục vào kho...", done: 0, total: rows.length });
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SteamGiftGame" ("appid", "name", "rank", "active", "createdAt", "updatedAt") VALUES ` +
        chunk.map((_, j) => `($${j * 3 + 1}, $${j * 3 + 2}, $${j * 3 + 3}, true, NOW(), NOW())`).join(", ") +
        ` ON CONFLICT ("appid") DO UPDATE SET "name" = EXCLUDED."name", "rank" = EXCLUDED."rank", "active" = true, "updatedAt" = NOW()`,
      ...chunk.flatMap((g, j) => [g.appid, g.name, i + j]),
    );
    onProgress?.({ phase: "Đang ghi danh mục vào kho...", done: Math.min(i + BATCH, rows.length), total: rows.length });
  }
  onProgress?.({ phase: "Đang tắt game đã biến mất khỏi danh sách FZR...", done: rows.length, total: rows.length });
  await prisma.steamGiftGame.updateMany({ where: { updatedAt: { lt: startedAt }, active: true }, data: { active: false } });
  await setSetting("steamgift_synced_at", new Date().toISOString());
  await setSetting("steamgift_count", String(rows.length));
  return { count: rows.length, total };
}

export async function buySteamGift(input: { userId: number; appid: number; subId: string; region: string; inviteUrl: string }) {
  const cfg = await giftConfig();
  if (!cfg.enabled) throw new Error("GIFT_UNAVAILABLE");
  const invite = input.inviteUrl.trim().slice(0, 300);
  if (invite.length < 8) throw new Error("GIFT_INVITE_REQUIRED");
  if (!Number.isInteger(input.appid) || input.appid <= 0 || !input.subId || !input.region) throw new Error("GIFT_OFFER_INVALID");

  const cat = await prisma.steamGiftGame.findUnique({ where: { appid: input.appid } });
  if (!cat || !cat.active) throw new Error("GIFT_GAME_UNAVAILABLE");

  const offers = await fzrGiftOffers(input.appid);
  if (!offers) throw new Error("GIFT_UNAVAILABLE");
  const offer = offers.find((o) => o.subId === input.subId);
  const regionRow = offer?.regions.find((r) => r.region === input.region);
  if (!offer || !regionRow) throw new Error("GIFT_OFFER_GONE");
  const gross = giftSellCents(regionRow.priceUsd, cfg.markupPct);

  const { game, pkg } = await ensureGiftCatalog();
  if (!game.active) throw new Error("GIFT_UNAVAILABLE");
  const order = await prisma.$transaction(async (tx) => {
    await applyBalance(tx, input.userId, -gross, "purchase", undefined, `Tặng game Steam ${cat.name}`);
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
            fieldsJson: {
              appid: input.appid,
              gameName: cat.name,
              subId: input.subId,
              edition: offer.name,
              region: input.region,
              inviteUrl: invite,
            },
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

  const result = await fulfillSteamGift(order.code, 1, { inviteUrl: invite, subId: input.subId, appId: input.appid, region: input.region });
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
    await notifyUser(input.userId, "ORDER", "Đơn hàng đã giao", `Đơn ${order.code} — game Steam đã được gửi tới tài khoản nhận.`, "/account/orders");
  } else if (result.status === "FAILED") {
    await notifyUser(input.userId, "ORDER", "Đơn hàng thất bại", `Đơn ${order.code} không gửi được quà Steam. Số tiền sẽ được xử lý theo chính sách hoàn tiền.`, "/account/orders");
  }
  await audit(input.userId, "order.create", `${order.code} STEAMGIFT ${cat.name} appid=${input.appid} sub=${input.subId} ${input.region} usd=${regionRow.priceUsd} ${gross}`);
  return order;
}
