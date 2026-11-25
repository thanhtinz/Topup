import { prisma } from "./db";
import { getSettings, setSetting, audit } from "./settings";
import { applyBalance } from "./wallet";
import { fzrTelegramStarsQuote, fzrTelegramPremiumPlans, fulfillTelegramStars, fulfillTelegramPremium, type FulfillResult } from "./providers";
import { newOrderCode, failOrderWithRefund } from "./orders";

export const TG_SLUG = "telegram";
export const TG_NAME = "Telegram";
export const TG_COVER = "/uploads/telegram-cover.jpg";

export const TG_STAR_PACKS = [50, 100, 200, 250, 500, 750, 1000, 2500, 5000, 10000, 25000, 50000, 75000, 100000];

export type TelegramConfig = { enabled: boolean; markupStars: number; markupPremium: number };

function parsePct(v: string | undefined, dflt: number): number {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? Math.min(100, Math.max(-50, n)) : dflt;
}

export async function telegramConfig(): Promise<TelegramConfig> {
  const s = await getSettings();
  return {
    enabled: s.module_telegram !== "0",
    markupStars: parsePct(s.telegram_markup_stars, 7),
    markupPremium: parsePct(s.telegram_markup_premium, 7),
  };
}

export function tgSellCents(usd: number, markupPct: number): number {
  return Math.max(1, Math.ceil(usd * 100 * (1 + markupPct / 100)));
}

export function tgCostCents(usd: number): number {
  return Math.max(0, Math.ceil(usd * 100));
}

const TG_DESC =
  "Nạp Telegram Stars và tặng Telegram Premium cho bất kỳ tài khoản Telegram nào — chỉ cần username (ví dụ @username), không cần mật khẩu. Stars dùng để mua vật phẩm trong các mini app và bot trên Telegram; Premium mở khoá giới hạn tải xuống, sticker độc quyền, chuyển giọng nói thành văn bản và nhiều đặc quyền khác. Giao tự động sau khi thanh toán, thường trong vòng một phút.";

export async function ensureTelegramCatalog() {
  const game = await prisma.game.upsert({
    where: { slug: TG_SLUG },
    create: {
      slug: TG_SLUG,
      name: TG_NAME,
      cover: TG_COVER,
      genre: "",
      regions: ["Global"],
      description: TG_DESC,
      compareApproved: true,
      priority: "FZR",
      fieldsJson: [{ key: "username", label: "Tên người dùng Telegram", type: "text", required: true }],
    },
    update: {},
  });
  return { game };
}

export async function syncTelegramCatalog(): Promise<{ stars: number; premium: number }> {
  const cfg = await telegramConfig();
  const { game } = await ensureTelegramCatalog();
  const [quote, plans] = await Promise.all([fzrTelegramStarsQuote(), fzrTelegramPremiumPlans()]);
  let stars = 0;
  let premium = 0;
  const keep = new Set<string>();

  if (quote) {
    const rows: { externalId: string; name: string; usd: number }[] =
      TG_STAR_PACKS.map((n) => ({ externalId: `telegram_stars::${n}`, name: `${n.toLocaleString("en-US")} Sao`, usd: quote.pricePerStar * n }));
    for (const r of rows) {
      keep.add(r.externalId);
      const data = { gameId: game.id, name: r.name, region: "Global", method: "UID", costCents: tgCostCents(r.usd), priceCents: tgSellCents(r.usd, cfg.markupStars), active: true };
      const found = await prisma.package.findFirst({ where: { provider: "FZR", externalId: r.externalId }, select: { id: true } });
      if (found) await prisma.package.update({ where: { id: found.id }, data });
      else await prisma.package.create({ data: { ...data, provider: "FZR", externalId: r.externalId } });
      stars++;
    }
  }
  for (const p of plans) {
    const externalId = `telegram_premium::${p.months}`;
    keep.add(externalId);
    const data = { gameId: game.id, name: `Premium ${p.months} tháng`, region: "Global", method: "UID", costCents: tgCostCents(p.priceUsd), priceCents: tgSellCents(p.priceUsd, cfg.markupPremium), active: true };
    const found = await prisma.package.findFirst({ where: { provider: "FZR", externalId }, select: { id: true } });
    if (found) await prisma.package.update({ where: { id: found.id }, data });
    else await prisma.package.create({ data: { ...data, provider: "FZR", externalId } });
    premium++;
  }
  if (quote || plans.length) {
    await prisma.package.updateMany({
      where: { gameId: game.id, provider: "FZR", externalId: { startsWith: "telegram_" }, NOT: { externalId: { in: [...keep] } } },
      data: { active: false },
    });
  }
  if (quote) await setSetting("telegram_per_star_usd", String(quote.pricePerStar));
  await setSetting("telegram_synced_at", new Date().toISOString());
  return { stars, premium };
}

export type TelegramPackageView = {
  id: number;
  kind: "stars" | "premium";
  itemKey: string; 
  name: string;
  priceCents: number;
  active: boolean;
};

export async function telegramPackages(): Promise<{ stars: TelegramPackageView[]; premium: TelegramPackageView[] }> {
  const { game } = await ensureTelegramCatalog();
  const rows = await prisma.package.findMany({ where: { gameId: game.id, active: true, provider: "FZR" }, orderBy: { priceCents: "asc" } });
  const stars: TelegramPackageView[] = [];
  const premium: TelegramPackageView[] = [];
  for (const r of rows) {
    const ext = r.externalId || "";
    if (ext.startsWith("telegram_stars::")) stars.push({ id: r.id, kind: "stars", itemKey: ext.slice("telegram_stars::".length), name: r.name, priceCents: r.priceCents, active: r.active });
    else if (ext.startsWith("telegram_premium::")) premium.push({ id: r.id, kind: "premium", itemKey: ext.slice("telegram_premium::".length), name: r.name, priceCents: r.priceCents, active: r.active });
  }
  stars.sort((a, b) => Number(a.itemKey) - Number(b.itemKey));
  premium.sort((a, b) => Number(a.itemKey) - Number(b.itemKey));
  return { stars, premium };
}

export function normalizeTgUsername(raw: string): string | null {
  const u = raw.trim().replace(/^@+/, "");
  return /^[A-Za-z0-9_]{5,32}$/.test(u) ? u : null;
}

export async function buyTelegram(input: {
  userId: number;
  kind: "stars" | "premium";
  itemKey: string;
  quantity: number;
  username: string;
  clientRef?: string;
}) {
  if (input.clientRef) {
    const dup = await prisma.order.findUnique({ where: { userId_clientRef: { userId: input.userId, clientRef: input.clientRef } } });
    if (dup) return dup;
  }
  const cfg = await telegramConfig();
  if (!cfg.enabled) throw new Error("TG_UNAVAILABLE");
  const username = normalizeTgUsername(input.username || "");
  if (!username) throw new Error("TG_USERNAME_INVALID");
  const qty = Math.floor(input.quantity);
  if (!Number.isInteger(qty) || qty < 1) throw new Error("TG_QTY_INVALID");

  const { game } = await ensureTelegramCatalog();
  if (!game.active) throw new Error("TG_UNAVAILABLE");
  const externalId = input.kind === "stars" ? `telegram_stars::${input.itemKey}` : `telegram_premium::${input.itemKey}`;
  const pkg = await prisma.package.findFirst({ where: { gameId: game.id, provider: "FZR", externalId, active: true } });
  if (!pkg) throw new Error("TG_PACKAGE_UNAVAILABLE");

  let gross = 0;
  let starsTotal = 0;
  let months = 0;
  let usdUnit = 0;
  if (input.kind === "stars") {
    const quote = await fzrTelegramStarsQuote();
    if (!quote) throw new Error("TG_UNAVAILABLE");
    const packStars = parseInt(input.itemKey, 10);
    if (!Number.isInteger(packStars) || packStars <= 0 || qty > 10) throw new Error("TG_QTY_INVALID");
    starsTotal = packStars * qty;
    if (starsTotal < quote.minAmount || starsTotal > quote.maxAmount) throw new Error("TG_STARS_RANGE");
    usdUnit = quote.pricePerStar;
    gross = pkg.priceCents * qty;
  } else {
    months = parseInt(input.itemKey, 10);
    if (!Number.isInteger(months) || months <= 0 || qty > 5) throw new Error("TG_QTY_INVALID");
    const plans = await fzrTelegramPremiumPlans();
    const plan = plans.find((p) => p.months === months);
    if (!plan) throw new Error("TG_PACKAGE_UNAVAILABLE");
    usdUnit = plan.priceUsd;
    gross = tgSellCents(plan.priceUsd, cfg.markupPremium) * qty;
  }

  const itemName = input.kind === "stars" ? `${starsTotal.toLocaleString("en-US")} Sao Telegram` : `Telegram Premium ${months} tháng`;
  const runTx = () => prisma.$transaction(async (tx) => {
    await applyBalance(tx, input.userId, -gross, "purchase", undefined, `Mua ${itemName} cho @${username}`);
    const created = await tx.order.create({
      data: {
        code: "TMP",
        userId: input.userId,
        gameId: game.id,
        totalCents: gross,
        clientRef: input.clientRef ?? null,
        status: "PROCESSING",
        items: {
          create: {
            packageId: pkg.id,
            qty: input.kind === "stars" ? 1 : qty,
            priceCents: gross,
            fieldsJson: { kind: input.kind, username, stars: starsTotal || undefined, months: months || undefined, itemKey: input.itemKey },
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


  let result: FulfillResult;
  let placedUnits = 0;
  if (input.kind === "stars") {
    result = await fulfillTelegramStars(order.code, 1, { username, quantity: starsTotal });
    if (result.status === "DELIVERED" || result.status === "PROCESSING") placedUnits = 1;
  } else {
    result = { status: "DELIVERED" };
    for (let i = 1; i <= qty; i++) {
      const r = await fulfillTelegramPremium(order.code, i, { username, months });
      if (r.status === "DELIVERED" || r.status === "PROCESSING") placedUnits++;
      if (r.status === "FAILED") { result = r; break; }
      if (r.status === "PENDING") { result = r; break; }
      if (r.status === "PROCESSING") result = r;
    }
  }

  await prisma.orderItem.updateMany({
    where: { orderId: order.id },
    data: { status: result.status === "DELIVERED" ? "DELIVERED" : result.status === "FAILED" ? "FAILED" : "PROCESSING", providerRef: "providerRef" in result ? result.providerRef : undefined },
  });
  const { notifyUser } = await import("./notify");
  if (result.status === "FAILED" && placedUnits === 0) {
    await failOrderWithRefund(order.id, input.userId, order.code);
  } else {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: result.status === "DELIVERED" ? "DELIVERED" : "PROCESSING", providerRef: "providerRef" in result ? result.providerRef : undefined, note: result.status === "PENDING" ? `Đối soát tay: ${result.reason}` : result.status === "FAILED" ? `Đối soát tay: giao một phần ${placedUnits}/${qty}` : undefined },
    });
    if (result.status === "DELIVERED") {
      const { awardCreatorCommissionForOrder } = await import("./creator");
      await awardCreatorCommissionForOrder(order.id);
      await notifyUser(input.userId, "ORDER", "Đơn hàng đã giao", `Đơn ${order.code} — ${itemName} đã được gửi tới @${username}.`, "/account/orders");
    } else if (result.status === "FAILED") {
      await notifyUser(input.userId, "ORDER", "Đơn hàng giao một phần", `Đơn ${order.code} mới giao được một phần. Phần còn lại đang được xử lý.`, "/account/orders");
    }
  }
  await audit(input.userId, "order.create", `${order.code} TELEGRAM ${input.kind} ${itemName} @${username} usd=${usdUnit} ${gross}`);
  return order;
}
