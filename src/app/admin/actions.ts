"use server";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin, requireOwner } from "@/lib/auth";
import { setSetting, audit } from "@/lib/settings";
import { encryptSecret } from "@/lib/crypto";
import { applyBalance } from "@/lib/wallet";
import { refundOrder } from "@/lib/orders";
import { getProviderBalance } from "@/lib/providers";
import { parseMoneyToCents } from "@/lib/money";

function back(path: string, msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}`);
}
function backErr(path: string, msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(msg)}`);
}
function destOf(formData: FormData, fallback: string): string {
  const backPath = String(formData.get("back") ?? "");
  const fq = String(formData.get("fq") ?? "").trim();
  if (backPath.startsWith("/admin/") && !backPath.includes("?") && !backPath.includes("..")) {
    return fq ? `${backPath}?${fq}` : backPath;
  }
  return fallback;
}

export async function toggleGameAction(formData: FormData) {
  const admin = await requireOwner();
  const id = Number(formData.get("id"));
  const g = await prisma.game.findUnique({ where: { id } });
  if (!g) backErr("/admin/games", "Không thấy game");
  await prisma.game.update({ where: { id }, data: { active: !g.active } });
  await audit(admin.id, "game.toggle", `${g.slug} -> ${!g.active}`);
  revalidatePath("/admin/games");
  back("/admin/games", `Đã ${!g.active ? "bật" : "tắt"} game ${g.name}`);
}

export async function saveGameMetaAction(formData: FormData) {
  const admin = await requireOwner();
  const gameId = Number(formData.get("gameId") ?? 0);
  if (!gameId) backErr("/admin/games", "Thiếu game");
  const data: { genre?: string; description?: string } = {};
  const saved: string[] = [];
  if (formData.has("genre")) { data.genre = String(formData.get("genre") ?? "").trim(); saved.push("thể loại"); }
  if (formData.has("description")) { data.description = String(formData.get("description") ?? "").trim().slice(0, 8000); saved.push("mô tả"); }
  if (!saved.length) backErr(`/admin/games/${gameId}`, "Không có gì để lưu");
  await prisma.game.update({ where: { id: gameId }, data });
  await audit(admin.id, "game.meta.save", `game=${gameId} fields=${saved.join(",")}`);
  back(`/admin/games/${gameId}`, "Đã lưu " + saved.join(" + "));
}

export async function createGameAction(formData: FormData) {
  const admin = await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const cover = String(formData.get("cover") ?? "").trim();
  const genre = String(formData.get("genre") ?? "").trim();
  if (!name || !slug || !cover) backErr("/admin/games/new", "Thiếu tên, slug hoặc bìa");
  const exists = await prisma.game.findUnique({ where: { slug } });
  if (exists) backErr("/admin/games/new", "Slug đã tồn tại");
  await prisma.game.create({
    data: {
      name, slug, cover, genre,
      regions: String(formData.get("regions") ?? "Global").split(",").map((x) => x.trim()).filter(Boolean),
      fieldsJson: [
        { key: "uid", label: "ID người chơi (UID)", required: true, placeholder: "Nhập UID trong game" },
      ],
    },
  });
  await audit(admin.id, "game.create", slug);
  back("/admin/games", "Đã thêm game " + name);
}

export async function togglePackageAction(formData: FormData) {
  const admin = await requireOwner();
  const id = Number(formData.get("id"));
  const gameId = Number(formData.get("gameId"));
  const dest = destOf(formData, `/admin/games/${gameId}`);
  const p = await prisma.package.findUnique({ where: { id } });
  if (!p) backErr(dest, "Không thấy gói");
  await prisma.package.update({ where: { id }, data: { active: !p.active } });
  await audit(admin.id, "package.toggle", `${id} -> ${!p.active}`);
  back(dest, `Đã ${!p.active ? "bật" : "tắt"} gói ${p.name}`);
}

export async function createPackageAction(formData: FormData) {
  const admin = await requireOwner();
  const gameId = Number(formData.get("gameId"));
  const name = String(formData.get("name") ?? "").trim();
  const price = parseMoneyToCents(String(formData.get("price") ?? ""));
  const cost = parseMoneyToCents(String(formData.get("cost") ?? ""));
  const list = parseMoneyToCents(String(formData.get("list") ?? ""));
  const dest = destOf(formData, `/admin/games/${gameId}`);
  if (!name || !price || !cost) backErr(dest, "Thiếu tên gói hoặc giá");
  const image = String(formData.get("image") ?? "").trim();
  await prisma.package.create({
    data: {
      gameId, name, priceCents: price, costCents: cost,
      listPriceCents: list && list > price ? list : null,
      imageUrl: image || null,
      region: String(formData.get("region") ?? "Global"),
      method: String(formData.get("method") ?? "UID"),
      provider: "MANUAL",
    },
  });
  await audit(admin.id, "package.create", `${gameId} ${name}`);
  back(dest, "Đã thêm gói " + name);
}

export async function setGamePriorityAction(formData: FormData) {
  const admin = await requireOwner();
  const gameId = Number(formData.get("gameId"));
  const priority = String(formData.get("priority") ?? "");
  const dest = destOf(formData, `/admin/games/${gameId}`);
  if (!["ERIS", "FZR", "ERIS_ONLY", "FZR_ONLY"].includes(priority)) backErr(dest, "Chế độ nguồn không hợp lệ");
  await prisma.game.update({ where: { id: gameId }, data: { priority } });
  await audit(admin.id, "game.priority", `${gameId} -> ${priority}`);
  back(dest, "Đã đổi chế độ nguồn");
}

export async function approveCompareAction(formData: FormData) {
  const admin = await requireOwner();
  const gameId = Number(formData.get("gameId"));
  const kind = String(formData.get("kind") ?? "");
  const dest = destOf(formData, "/admin/compare");
  if (kind !== "approve" && kind !== "unapprove") backErr(dest, "Thao tác duyệt không hợp lệ");
  const approved = kind === "approve";
  await prisma.game.update({ where: { id: gameId }, data: { compareApproved: approved } });
  await audit(admin.id, "game.compareApprove", `${gameId} -> ${approved}`);
  back(dest, approved ? "Đã duyệt — game hiện phía khách" : "Đã bỏ duyệt — game ẩn phía khách");
}

export async function saveUidGuideAction(formData: FormData) {
  const admin = await requireOwner();
  const gameId = Number(formData.get("gameId"));
  const { textToGuide } = await import("@/lib/guide");
  const steps = textToGuide(String(formData.get("guide") ?? ""));
  await prisma.game.update({ where: { id: gameId }, data: { uidGuideJson: steps } });
  await audit(admin.id, "game.uidGuide", `${gameId}: ${steps.length} bước`);
  back(`/admin/games/${gameId}`, `Đã lưu hướng dẫn lấy UID (${steps.length} bước)`);
}

export async function setOrderStatusAction(formData: FormData) {
  const admin = await requireOwner();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  const allowed = ["PENDING", "PROCESSING", "PARTIAL", "DELIVERED", "FAILED", "CANCELLED"];
  if (!allowed.includes(status)) backErr("/admin/orders", "Trạng thái không hợp lệ");
  await prisma.order.update({ where: { id }, data: { status: status as never } });
  await prisma.orderItem.updateMany({ where: { orderId: id }, data: { status: status as never } });
  if (status === "DELIVERED") {
    const { awardCreatorCommissionForOrder } = await import("@/lib/creator");
    await awardCreatorCommissionForOrder(id);
  }
  if (status === "FAILED" || status === "CANCELLED") {
    const { reverseCreatorCommissionForOrder } = await import("@/lib/creator");
    await reverseCreatorCommissionForOrder(id, admin.id);
  }
  if (status === "DELIVERED" || status === "FAILED" || status === "CANCELLED") {
    const ord = await prisma.order.findUnique({ where: { id }, select: { userId: true, code: true } });
    if (ord) {
      const { notifyUser } = await import("@/lib/notify");
      const title = status === "DELIVERED" ? "Đơn hàng đã giao" : status === "FAILED" ? "Đơn hàng thất bại" : "Đơn hàng đã huỷ";
      const body = status === "DELIVERED" ? `Đơn ${ord.code} đã nạp thành công vào tài khoản game của bạn.` : `Đơn ${ord.code} ${status === "FAILED" ? "không nạp được" : "đã bị huỷ"}. Xem chi tiết trong Đơn hàng.`;
      await notifyUser(ord.userId, "ORDER", title, body, "/account/orders");
    }
  }
  await audit(admin.id, "order.status", `${id} -> ${status}`);
  back("/admin/orders", "Đã cập nhật trạng thái đơn");
}

export async function refundOrderAction(formData: FormData) {
  const admin = await requireOwner();
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "refund") backErr("/admin/orders", "Thao tác tiền không rõ ràng — đã chặn");
  const id = Number(formData.get("id"));
  try {
    const o = await refundOrder(id);
    await audit(admin.id, "order.refund", o.code);
    back("/admin/orders", "Đã hoàn tiền đơn " + o.code);
  } catch (e) {
    unstable_rethrow(e); 
    backErr("/admin/orders", "Không hoàn được: " + (e instanceof Error ? e.message : "lỗi"));
  }
}

export async function decideDepositAction(formData: FormData) {
  const admin = await requireOwner();
  const kind = String(formData.get("kind") ?? "");
  const id = Number(formData.get("id"));
  if (kind !== "approve" && kind !== "reject") {
    backErr("/admin/deposits", "Thao tác không rõ ràng (thiếu kind) — đã chặn, không cộng tiền");
  }
  const dep = await prisma.depositRequest.findUnique({ where: { id } });
  if (!dep || dep.status !== "PENDING") backErr("/admin/deposits", "Lệnh nạp không còn chờ duyệt");
  if (kind === "reject") {
    await prisma.depositRequest.update({ where: { id }, data: { status: "REJECTED", decidedAt: new Date() } });
    const { notifyUser } = await import("@/lib/notify");
    await notifyUser(dep.userId, "DEPOSIT", "Lệnh nạp bị từ chối", `Lệnh nạp ${dep.code} đã bị từ chối. Liên hệ hỗ trợ nếu cần kiểm tra lại.`, "/account/deposit");
    await audit(admin.id, "deposit.reject", dep.code);
    back("/admin/deposits", "Đã từ chối lệnh " + dep.code);
  }
  await prisma.$transaction(async (tx) => {
    await applyBalance(tx, dep.userId, dep.amountCents, "deposit", dep.code, "Duyệt nạp " + dep.code);
    await tx.depositRequest.update({ where: { id }, data: { status: "APPROVED", decidedAt: new Date() } });
    const { notifyUser } = await import("@/lib/notify");
    const { fmtUSD } = await import("@/lib/money");
    await notifyUser(dep.userId, "DEPOSIT", "Nạp tiền thành công", `+${fmtUSD(dep.amountCents)} đã cộng vào ví của bạn (lệnh ${dep.code}).`, "/account/deposit", tx);
  });
  await audit(admin.id, "deposit.approve", dep.code);
  back("/admin/deposits", "Đã cộng tiền lệnh " + dep.code);
}

export async function adjustBalanceAction(formData: FormData) {
  const admin = await requireOwner();
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "add" && kind !== "subtract") backErr("/admin/users", "Thao tác tiền không rõ ràng — đã chặn");
  const userId = Number(formData.get("userId"));
  const cents = parseMoneyToCents(String(formData.get("amount") ?? ""));
  if (!cents) backErr("/admin/users", "Số tiền không hợp lệ");
  const delta = kind === "add" ? cents : -cents;
  try {
    await prisma.$transaction(async (tx) => {
      await applyBalance(tx, userId, delta, "admin_adjust", undefined, `Admin ${admin.email} ${kind === "add" ? "cộng" : "trừ"} tay`);
    });
  } catch {
    backErr("/admin/users", "Không thực hiện được (số dư không đủ hoặc user không tồn tại)");
  }
  await audit(admin.id, "wallet.adjust", `${userId} ${delta}`);
  back("/admin/users", "Đã điều chỉnh ví");
}

export async function toggleUserAction(formData: FormData) {
  const admin = await requireOwner();
  const id = Number(formData.get("id"));
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.role === "ADMIN") backErr("/admin/users", "Không khoá được tài khoản này");
  await prisma.user.update({ where: { id }, data: { active: !u.active } });
  await audit(admin.id, "user.toggle", `${u.email} -> ${!u.active}`);
  back("/admin/users", "Đã cập nhật tài khoản");
}

export async function saveProviderAction(formData: FormData) {
  const admin = await requireOwner();
  const code = String(formData.get("code") ?? "");
  if (code !== "FZR" && code !== "ERIS") backErr("/admin/providers", "Nhà cung cấp không hợp lệ");
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const data: Record<string, unknown> = {
    baseUrl: String(formData.get("baseUrl") ?? "").trim(),
    markupPercent: Math.max(0, Number(formData.get("markup") ?? 0) || 0),
    enabled: formData.get("enabled") === "1",
  };
  if (apiKey) data.apiKeyEnc = encryptSecret(apiKey);
  await prisma.provider.update({ where: { code }, data });
  await audit(admin.id, "provider.save", code);
  back(`/admin/providers/${code}`, "Đã lưu cấu hình " + code);
}


export async function checkBalanceAction(formData: FormData) {
  await requireAdmin();
  const code = String(formData.get("code") ?? "");
  if (code !== "FZR" && code !== "ERIS") backErr("/admin/providers", "Nhà cung cấp không hợp lệ");
  const bal = await getProviderBalance(code);
  back(`/admin/providers/${code}`, `Số dư ${code}: ${bal}`);
}

export async function saveSettingsAction(formData: FormData) {
  const admin = await requireOwner();
  const path = String(formData.get("_path") ?? "/admin/website");
  const prefix = String(formData.get("_prefix") ?? "");
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("_") || k === "$ACTION_ID") continue;
    if (prefix && !k.startsWith(prefix)) continue;
    await setSetting(k, String(v));
  }
  for (const k of String(formData.get("_checkboxes") ?? "").split(",").filter(Boolean)) {
    if (formData.get(k) !== "1") await setSetting(k, "0");
  }
  await audit(admin.id, "settings.save", path);
  back(path, "Đã lưu cấu hình");
}

export async function saveSteamConfigAction(formData: FormData) {
  const admin = await requireOwner();
  const num = (k: string, min: number, max: number, fallback: number) => {
    const v = parseFloat(String(formData.get(k) ?? ""));
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  };
  const unitUsd = num("steam_unit_price", 0.01, 1000, 1.02);
  await setSetting("steam_unit_price_cents", String(Math.round(unitUsd * 100)));
  await setSetting("steam_discount_percent", String(num("steam_discount_percent", 0, 99, 0)));
  await setSetting("steam_receive_rate_vnd", String(Math.round(num("steam_receive_rate_vnd", 0, 1000000, 26000))));
  await setSetting("steam_min_usd", String(num("steam_min_usd", 0.1, 1000, 0.1)));
  await setSetting("steam_max_usd", String(num("steam_max_usd", 1, 100000, 1000)));
  const { ensureSteamCatalog } = await import("@/lib/steam");
  await ensureSteamCatalog();
  await audit(admin.id, "steam.config.save", "");
  back("/admin/steam", "Đã lưu cấu hình Steam Top-Up");
}

export async function saveSteamGiftConfigAction(formData: FormData) {
  const admin = await requireOwner();
  const v = parseFloat(String(formData.get("steamgift_markup_percent") ?? ""));
  const markup = Number.isFinite(v) ? Math.min(100, Math.max(-50, v)) : 2;
  await setSetting("steamgift_markup_percent", String(markup));
  const { ensureGiftCatalog } = await import("@/lib/steamgift");
  await ensureGiftCatalog();
  await audit(admin.id, "steamgift.config.save", `markup=${markup}`);
  back("/admin/steam-gift", "Đã lưu cấu hình Steam Gift");
}


export async function saveTelegramConfigAction(formData: FormData) {
  const admin = await requireOwner();
  const pct = (name: string, dflt: number) => {
    const v = parseFloat(String(formData.get(name) ?? ""));
    return Number.isFinite(v) ? Math.min(100, Math.max(-50, v)) : dflt;
  };
  const markupStars = pct("telegram_markup_stars", 7);
  const markupPremium = pct("telegram_markup_premium", 7);
  await setSetting("telegram_markup_stars", String(markupStars));
  await setSetting("telegram_markup_premium", String(markupPremium));
  try {
    const { syncTelegramCatalog } = await import("@/lib/telegram");
    await syncTelegramCatalog();
  } catch { /* xem ghi chú trên */ }
  await audit(admin.id, "telegram.config.save", `markupStars=${markupStars} markupPremium=${markupPremium}`);
  back("/admin/telegram", "Đã lưu cấu hình Telegram");
}

export async function saveGatewayAction(formData: FormData) {
  const admin = await requireOwner();
  const { setSetting } = await import("@/lib/settings");
  const { sealSecret } = await import("@/lib/gateways");
  const gw = String(formData.get("gateway") ?? "");
  if (gw === "sepay") {
    await setSetting("pay_sepay_enabled", formData.get("pay_sepay_enabled") === "1" ? "1" : "0");
    for (const k of ["sepay_bank_name", "sepay_bank_bin", "sepay_account_number", "sepay_account_name"]) {
      await setSetting(k, String(formData.get(k) ?? "").trim());
    }
    const sec = String(formData.get("sepay_secret") ?? "").trim();
    if (sec) await setSetting("sepay_secret", sealSecret(sec));
  } else if (gw === "bntpay") {
    await setSetting("pay_bntpay_enabled", formData.get("pay_bntpay_enabled") === "1" ? "1" : "0");
    for (const k of ["bntpay_api_url", "bntpay_network", "bntpay_expires_minutes"]) {
      await setSetting(k, String(formData.get(k) ?? "").trim());
    }
    for (const k of ["bntpay_api_key", "bntpay_webhook_secret"]) {
      const v = String(formData.get(k) ?? "").trim();
      if (v) await setSetting(k, sealSecret(v));
    }
  } else {
    backErr("/admin/payments", "Cổng không hợp lệ");
  }
  await audit(admin.id, "payments.save", gw);
  back(`/admin/payments/${gw}`, `Đã lưu cấu hình ${gw === "sepay" ? "SePay" : "BNT Pay"}`);
}

export async function testGatewayAction(formData: FormData) {
  await requireOwner();
  const { getSettings } = await import("@/lib/settings");
  const { openSecret, bntpayPing, BNTPAY_NETWORKS, BNTPAY_DEFAULT_API_URL } = await import("@/lib/gateways");
  const s = await getSettings();
  const gw = String(formData.get("gateway") ?? "");
  const dest = `/admin/payments/${gw}`;
  if (gw === "bntpay") {
    const apiKey = String(formData.get("bntpay_api_key") ?? "").trim() || openSecret(s.bntpay_api_key);
    const webhookSecret = String(formData.get("bntpay_webhook_secret") ?? "").trim() || openSecret(s.bntpay_webhook_secret);
    const exp = parseInt(String(formData.get("bntpay_expires_minutes") ?? "30")) || 30;
    const network = String(formData.get("bntpay_network") ?? "TRON");
    const cfg = {
      enabled: true,
      configured: !!apiKey && !!webhookSecret,
      apiKey,
      webhookSecret,
      apiUrl: (String(formData.get("bntpay_api_url") ?? "").trim() || BNTPAY_DEFAULT_API_URL).replace(/\/+$/, ""),
      network: (BNTPAY_NETWORKS as readonly string[]).includes(network) ? network : "TRON",
      expiresMinutes: Math.min(60, Math.max(15, exp)),
    };
    const r = await bntpayPing(cfg);
    if (r.ok) back(dest, "BNT Pay: " + r.detail);
    backErr(dest, "BNT Pay: " + r.detail);
  }
  if (gw === "sepay") {
    const secret = String(formData.get("sepay_secret") ?? "").trim() || openSecret(s.sepay_secret);
    const account = String(formData.get("sepay_account_number") ?? "").trim();
    if (!secret || !account) backErr(dest, "SePay: cần điền Số tài khoản và Khoá webhook trước khi kiểm tra");
    const { headers } = await import("next/headers");
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost"}`;
    let status = 0;
    let fetchError = "";
    try {
      const res = await fetch(`${origin}/api/webhooks/sepay`, {
        method: "POST",
        headers: { authorization: `Apikey ${secret}`, "content-type": "application/json" },
        body: JSON.stringify({ id: "TESTPING", content: "KIEM TRA KET NOI", transferAmount: 0, transferType: "out" }),
      });
      status = res.status;
    } catch (e) {
      fetchError = e instanceof Error ? e.message : String(e);
    }
    if (status === 200) back(dest, "SePay: khoá webhook khớp, endpoint webhook đang sống — cấu hình sẵn sàng");
    if (fetchError) backErr(dest, "SePay: không gọi được endpoint webhook của chính site (" + fetchError + ")");
    backErr(dest, `SePay: webhook trả ${status} — khoá chưa khớp hoặc endpoint lỗi`);
  }
  backErr("/admin/payments", "Cổng không hợp lệ");
}

export async function createDiscountAction(formData: FormData) {
  const admin = await requireOwner();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const percent = Math.min(90, Math.max(1, Number(formData.get("percent") ?? 0) || 0));
  if (!code || !percent) backErr("/admin/discounts", "Thiếu mã hoặc % giảm");
  const exists = await prisma.discountCode.findUnique({ where: { code } });
  if (exists) backErr("/admin/discounts", "Mã đã tồn tại");
  await prisma.discountCode.create({ data: { code, percent, maxUses: Number(formData.get("maxUses") ?? 0) || null } });
  await audit(admin.id, "discount.create", code);
  back("/admin/discounts", "Đã tạo mã " + code);
}

export async function toggleDiscountAction(formData: FormData) {
  await requireOwner();
  const id = Number(formData.get("id"));
  const d = await prisma.discountCode.findUnique({ where: { id } });
  if (!d) backErr("/admin/discounts", "Không thấy mã");
  await prisma.discountCode.update({ where: { id }, data: { active: !d.active } });
  back("/admin/discounts", "Đã cập nhật mã " + d.code);
}

export async function saveCurrencyAction(formData: FormData) {
  const admin = await requireOwner();
  const code = String(formData.get("code") ?? "").toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const symbol = String(formData.get("symbol") ?? "").trim();
  const rate = Number(formData.get("rate"));
  const decimals = Math.min(4, Math.max(0, Number(formData.get("decimals") ?? 2)));
  const enabled = formData.get("enabled") === "1";
  if (!/^[A-Z]{3}$/.test(code) || !name || !(rate > 0)) backErr("/admin/currencies", "Mã tiền tệ phải có 3 chữ cái và tỉ giá phải lớn hơn 0");
  await prisma.currency.upsert({
    where: { code },
    create: { code, name, symbol: symbol || code, ratePerUsd: rate, decimals, enabled },
    update: { name, symbol: symbol || code, ratePerUsd: rate, decimals, enabled },
  });
  if (code === "VND") await setSetting("fx_usd_vnd", String(Math.round(rate)));
  await audit(admin.id, "currency.save", `${code} rate=${rate} enabled=${enabled}`);
  back("/admin/currencies", `Đã lưu tiền tệ ${code}`);
}

export async function setDefaultCurrencyAction(formData: FormData) {
  const admin = await requireOwner();
  const code = String(formData.get("code") ?? "");
  await prisma.$transaction([
    prisma.currency.updateMany({ data: { isDefault: false } }),
    prisma.currency.update({ where: { code }, data: { isDefault: true, enabled: true } }),
  ]);
  await audit(admin.id, "currency.default", code);
  back("/admin/currencies", `${code} là tiền tệ mặc định`);
}

export async function deleteCurrencyAction(formData: FormData) {
  const admin = await requireOwner();
  const code = String(formData.get("code") ?? "");
  if (code === "USD") backErr("/admin/currencies", "Không xoá được USD — đây là tiền tệ gốc của hệ thống");
  const cur = await prisma.currency.findUnique({ where: { code } });
  if (cur?.isDefault) backErr("/admin/currencies", "Đang là tiền tệ mặc định — chọn mặc định khác trước khi xoá");
  await prisma.currency.delete({ where: { code } });
  await audit(admin.id, "currency.delete", code);
  back("/admin/currencies", `Đã xoá tiền tệ ${code}`);
}

export async function saveLanguagesAction(formData: FormData) {
  const admin = await requireOwner();
  const en = formData.get("lang_en_enabled") === "1" ? "1" : "0";
  const def = String(formData.get("lang_default") ?? "vi");
  await setSetting("lang_en_enabled", en);
  await setSetting("lang_default", def === "en" && en === "1" ? "en" : "vi");
  await audit(admin.id, "language.save", `en=${en} default=${def}`);
  back("/admin/languages", "Đã lưu cấu hình ngôn ngữ");
}

export async function saveAllPackagesAction(formData: FormData) {
  const admin = await requireOwner();
  const gameId = Number(formData.get("gameId") ?? 0);
  const dest = destOf(formData, gameId ? `/admin/games/${gameId}/packages` : "/admin/games");
  const ids = String(formData.get("ids") ?? "").split(",").map((x) => Number(x)).filter(Boolean);
  let changed = 0;
  for (const id of ids) {
    const p = await prisma.package.findUnique({ where: { id } });
    if (!p || (gameId && p.gameId !== gameId)) continue;
    const name = String(formData.get(`name_${id}`) ?? "").trim();
    const price = parseMoneyToCents(String(formData.get(`price_${id}`) ?? ""));
    const cost = parseMoneyToCents(String(formData.get(`cost_${id}`) ?? ""));
    if (!name || !price || price <= 0) backErr(dest, `Gói #${id}: tên hoặc giá bán không hợp lệ`);
    const listRaw = String(formData.get(`list_${id}`) ?? "").trim();
    const list = listRaw === "" ? null : parseMoneyToCents(listRaw);
    const imgRaw = String(formData.get(`img_${id}`) ?? "").trim();
    const img = imgRaw === "" ? null : imgRaw;
    const data: { name?: string; priceCents?: number; costCents?: number; listPriceCents?: number | null; imageUrl?: string | null } = {};
    if (name !== p.name) data.name = name;
    if (price !== p.priceCents) data.priceCents = price;
    if (cost && cost !== p.costCents) data.costCents = cost;
    if (list !== p.listPriceCents) data.listPriceCents = list && list > 0 ? list : null;
    if (img !== p.imageUrl) data.imageUrl = img;
    if (Object.keys(data).length) {
      await prisma.package.update({ where: { id }, data });
      changed++;
    }
  }
  await audit(admin.id, "package.saveAll", `game ${gameId}: ${changed} gói`);
  back(dest, `Đã lưu thay đổi cho ${changed} gói`);
}

export async function deletePackageAction(formData: FormData) {
  const admin = await requireOwner();
  const id = Number(formData.get("id"));
  const gameId = Number(formData.get("gameId"));
  const dest = destOf(formData, `/admin/games/${gameId}`);
  const used = await prisma.orderItem.count({ where: { packageId: id } });
  if (used > 0) backErr(dest, "Gói đã có đơn — không xoá được, chỉ tắt gói");
  await prisma.package.delete({ where: { id } });
  await audit(admin.id, "package.delete", String(id));
  back(dest, "Đã xoá gói");
}

export async function savePointsConfigAction(formData: FormData) {
  const admin = await requireOwner();
  const num = (name: string, min: number, max: number, fallback: number) => {
    const v = parseInt(String(formData.get(name) ?? ""), 10);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  };
  await setSetting("module_points", formData.get("module_points") === "1" ? "1" : "0");
  await setSetting("points_per_review", String(num("points_per_review", 0, 1000, 2)));
  await setSetting("points_daily_cap", String(num("points_daily_cap", 0, 100, 4)));
  await setSetting("points_max_pay_percent", String(num("points_max_pay_percent", 0, 100, 5)));
  await setSetting("vip_late_hours", String(num("vip_late_hours", 1, 720, 24)));
  await setSetting("vip_late_points", String(num("vip_late_points", 0, 100000, 50)));
  await audit(admin.id, "points.config", "");
  back("/admin/points?tab=config", "Đã lưu cấu hình điểm");
}

export async function addPointsAction(formData: FormData) {
  formData.set("kind", "add");
  return adjustPointsAction(formData);
}

export async function subtractPointsAction(formData: FormData) {
  formData.set("kind", "subtract");
  return adjustPointsAction(formData);
}

export async function adjustPointsAction(formData: FormData) {
  const admin = await requireOwner();
  const dest = "/admin/points?tab=customers";
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "add" && kind !== "subtract") backErr(dest, "Thao tác điểm không hợp lệ");
  const userId = parseInt(String(formData.get("userId") ?? ""), 10) || 0;
  const amount = parseInt(String(formData.get("amount") ?? ""), 10) || 0;
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || "Admin điều chỉnh điểm";
  if (!userId || amount <= 0 || amount > 1000000) backErr(dest, "Số điểm không hợp lệ");
  const { applyPoints } = await import("@/lib/points");
  try {
    await prisma.$transaction(async (tx) => {
      await applyPoints(tx, userId, kind === "add" ? amount : -amount, "ADMIN", undefined, note);
    });
  } catch (e) {
    backErr(dest, e instanceof Error && e.message === "POINTS_INSUFFICIENT" ? "Khách không đủ điểm để trừ" : "Không điều chỉnh được điểm");
  }
  await audit(admin.id, "points.adjust", `user ${userId} ${kind} ${amount}`);
  back(dest, kind === "add" ? `Đã cộng ${amount} điểm` : `Đã trừ ${amount} điểm`);
}

export async function saveVipTiersAction(formData: FormData) {
  const admin = await requireOwner();
  const dest = "/admin/vip";
  const ids = String(formData.get("ids") ?? "").split(",").map((x) => parseInt(x, 10)).filter(Boolean);
  if (!ids.length) backErr(dest, "Chưa có cấp VIP nào");
  type Row = { id: number; name: string; thresholdCents: number; discountPercent: number; couponPercent: number; lateComp: boolean };
  const rows: Row[] = [];
  for (const id of ids) {
    const name = String(formData.get(`name_${id}`) ?? "").trim().slice(0, 30);
    const thUsd = parseFloat(String(formData.get(`th_${id}`) ?? ""));
    const disc = parseInt(String(formData.get(`disc_${id}`) ?? ""), 10);
    const coup = parseInt(String(formData.get(`coup_${id}`) ?? ""), 10);
    if (!name) backErr(dest, "Tên cấp không được trống");
    if (!Number.isFinite(thUsd) || thUsd < 0) backErr(dest, `Ngưỡng của cấp ${name} không hợp lệ`);
    rows.push({
      id,
      name,
      thresholdCents: Math.round(thUsd * 100),
      discountPercent: Math.min(100, Math.max(0, Number.isFinite(disc) ? disc : 0)),
      couponPercent: Math.min(100, Math.max(0, Number.isFinite(coup) ? coup : 0)),
      lateComp: formData.get(`late_${id}`) === "1",
    });
  }
  const names = rows.map((r) => r.name.toLowerCase());
  if (new Set(names).size !== names.length) backErr(dest, "Tên cấp bị trùng");
  const sorted = [...rows].sort((a, b) => a.thresholdCents - b.thresholdCents);
  if (sorted[0].thresholdCents !== 0) backErr(dest, "Phải có đúng 1 cấp nền với ngưỡng $0");
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].thresholdCents <= sorted[i - 1].thresholdCents) backErr(dest, "Ngưỡng các cấp phải tăng dần, không trùng nhau");
  }
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      await tx.vipTier.update({ where: { id: r.id }, data: { name: r.name, thresholdCents: r.thresholdCents, discountPercent: r.discountPercent, couponPercent: r.couponPercent, lateComp: r.lateComp, sort: i } });
    }
  });
  await audit(admin.id, "vip.tiers.save", rows.map((r) => r.name).join(","));
  back(dest, "Đã lưu các cấp VIP");
}

export async function addVipTierAction(formData: FormData) {
  const admin = await requireOwner();
  const name = String(formData.get("name") ?? "").trim().slice(0, 30);
  const thUsd = parseFloat(String(formData.get("threshold") ?? ""));
  if (!name) backErr("/admin/vip", "Chưa nhập tên cấp");
  if (!Number.isFinite(thUsd) || thUsd <= 0) backErr("/admin/vip", "Ngưỡng chi tiêu phải lớn hơn 0");
  const dup = await prisma.vipTier.findFirst({ where: { OR: [{ name }, { thresholdCents: Math.round(thUsd * 100) }] } });
  if (dup) backErr("/admin/vip", "Tên cấp hoặc ngưỡng đã tồn tại");
  const max = await prisma.vipTier.aggregate({ _max: { sort: true } });
  await prisma.vipTier.create({ data: { name, thresholdCents: Math.round(thUsd * 100), sort: (max._max.sort ?? 0) + 1 } });
  await audit(admin.id, "vip.tier.add", name);
  back("/admin/vip", `Đã thêm cấp ${name}`);
}

export async function deleteVipTierAction(formData: FormData) {
  const admin = await requireOwner();
  const id = parseInt(String(formData.get("id") ?? ""), 10) || 0;
  const tier = await prisma.vipTier.findUnique({ where: { id } });
  if (!tier) backErr("/admin/vip", "Không tìm thấy cấp");
  if (tier.thresholdCents === 0) backErr("/admin/vip", "Không xoá được cấp nền (ngưỡng $0)");
  const count = await prisma.vipTier.count();
  if (count <= 1) backErr("/admin/vip", "Phải giữ ít nhất 1 cấp VIP");
  await prisma.vipTier.delete({ where: { id } });
  await audit(admin.id, "vip.tier.delete", tier.name);
  back("/admin/vip", `Đã xoá cấp ${tier.name}`);
}

export async function uploadTierIconAction(formData: FormData) {
  const admin = await requireOwner();
  const tierId = parseInt(String(formData.get("tierId") ?? ""), 10) || 0;
  const tier = await prisma.vipTier.findUnique({ where: { id: tierId } });
  if (!tier) backErr("/admin/vip", "Không tìm thấy cấp VIP");
  const file = formData.get("icon");
  if (!(file instanceof File) || file.size === 0) backErr("/admin/vip", "Chưa chọn file icon");
  if (file.size > 2 * 1024 * 1024) backErr("/admin/vip", "Icon tối đa 2MB");
  const okTypes: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg", "image/gif": "gif" };
  const ext = okTypes[file.type];
  if (!ext) backErr("/admin/vip", "Chỉ nhận file PNG, JPG, WEBP, SVG hoặc GIF");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const pathMod = await import("node:path");
  const dir = pathMod.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const name = `vip-tier-${tier.id}-${Date.now()}.${ext}`;
  await writeFile(pathMod.join(dir, name), Buffer.from(await file.arrayBuffer()));
  await prisma.vipTier.update({ where: { id: tier.id }, data: { iconUrl: `/uploads/${name}` } });
  await audit(admin.id, "vip.tier.icon", tier.name);
  back("/admin/vip", `Đã tải icon cho cấp ${tier.name}`);
}


export async function saveGameBannerAction(formData: FormData) {
  const admin = await requireOwner();
  const gameId = parseInt(String(formData.get("gameId") ?? ""), 10) || 0;
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) backErr("/admin/games", "Không tìm thấy game");
  const url = String(formData.get("bannerUrl") ?? "").trim();
  await prisma.game.update({ where: { id: game.id }, data: { bannerUrl: url || null } });
  await audit(admin.id, "game.banner", game.slug);
  back(`/admin/games/${game.id}`, url ? "Đã lưu ảnh banner" : "Đã gỡ ảnh banner");
}

export async function uploadGameBannerAction(formData: FormData) {
  const admin = await requireOwner();
  const gameId = parseInt(String(formData.get("gameId") ?? ""), 10) || 0;
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) backErr("/admin/games", "Không tìm thấy game");
  const dest = `/admin/games/${game.id}`;
  const file = formData.get("banner");
  if (!(file instanceof File) || file.size === 0) backErr(dest, "Chưa chọn file ảnh banner");
  if (file.size > 4 * 1024 * 1024) backErr(dest, "Ảnh banner tối đa 4MB");
  const okTypes: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
  const ext = okTypes[file.type];
  if (!ext) backErr(dest, "Chỉ nhận file PNG, JPG hoặc WEBP");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const pathMod = await import("node:path");
  const dir = pathMod.join(process.cwd(), "public", "uploads", "banners");
  await mkdir(dir, { recursive: true });
  const name = `game-${game.id}-${Date.now()}.${ext}`;
  await writeFile(pathMod.join(dir, name), Buffer.from(await file.arrayBuffer()));
  await prisma.game.update({ where: { id: game.id }, data: { bannerUrl: `/uploads/banners/${name}` } });
  await audit(admin.id, "game.banner.upload", game.slug);
  back(dest, "Đã tải ảnh banner lên");
}

export async function removeTierIconAction(formData: FormData) {
  const admin = await requireOwner();
  const tierId = parseInt(String(formData.get("tierId") ?? ""), 10) || 0;
  const tier = await prisma.vipTier.findUnique({ where: { id: tierId } });
  if (!tier) backErr("/admin/vip", "Không tìm thấy cấp VIP");
  await prisma.vipTier.update({ where: { id: tier.id }, data: { iconUrl: null } });
  await audit(admin.id, "vip.tier.icon.remove", tier.name);
  back("/admin/vip", `Đã gỡ icon cấp ${tier.name}, dùng vương miện mặc định`);
}

export async function saveFacebookLoginAction(formData: FormData) {
  const admin = await requireOwner();
  const { sealSecret } = await import("@/lib/gateways");
  await setSetting("fb_login_enabled", formData.get("fb_login_enabled") === "1" ? "1" : "0");
  await setSetting("fb_app_id", String(formData.get("fb_app_id") ?? "").trim());
  const secret = String(formData.get("fb_app_secret") ?? "").trim();
  if (secret) await setSetting("fb_app_secret", sealSecret(secret));
  await audit(admin.id, "facebook.save", "");
  back("/admin/website?tab=facebook", "Đã lưu cấu hình đăng nhập Facebook");
}

export async function saveSmtpAction(formData: FormData) {
  const admin = await requireOwner();
  const { sealSecret } = await import("@/lib/gateways");
  await setSetting("smtp_host", String(formData.get("smtp_host") ?? "").trim());
  await setSetting("smtp_port", String(parseInt(String(formData.get("smtp_port") ?? "587"), 10) || 587));
  await setSetting("smtp_user", String(formData.get("smtp_user") ?? "").trim());
  await setSetting("smtp_from", String(formData.get("smtp_from") ?? "").trim());
  await setSetting("smtp_secure", formData.get("smtp_secure") === "1" ? "1" : "0");
  const pass = String(formData.get("smtp_pass") ?? "").trim();
  if (pass) await setSetting("smtp_pass", sealSecret(pass));
  await audit(admin.id, "smtp.save", "");
  back("/admin/website?tab=email", "Đã lưu cấu hình email");
}

export async function testSmtpAction(formData: FormData) {
  const admin = await requireOwner();
  const to = String(formData.get("test_email") ?? "").trim() || admin.email;
  const { isMailConfigured, sendMail } = await import("@/lib/mailer");
  if (!(await isMailConfigured())) backErr("/admin/website?tab=email", "Chưa đủ cấu hình SMTP (cần host, tài khoản và mật khẩu)");
  const ok = await sendMail(to, "Email thử từ BNT Game", "<p>Đây là email thử — cấu hình SMTP của BNT Game đang hoạt động.</p>");
  if (!ok) backErr("/admin/website?tab=email", `Gửi thử tới ${to} thất bại — kiểm tra lại host/cổng/tài khoản/mật khẩu`);
  await audit(admin.id, "smtp.test", to);
  back("/admin/website?tab=email", `Đã gửi email thử tới ${to}`);
}

export async function saveGoogleLoginAction(formData: FormData) {
  const admin = await requireOwner();
  const { sealSecret } = await import("@/lib/gateways");
  await setSetting("google_login_enabled", formData.get("google_login_enabled") === "1" ? "1" : "0");
  await setSetting("google_client_id", String(formData.get("google_client_id") ?? "").trim());
  const secret = String(formData.get("google_client_secret") ?? "").trim();
  if (secret) await setSetting("google_client_secret", sealSecret(secret));
  await audit(admin.id, "google.save", "");
  back("/admin/website?tab=google", "Đã lưu cấu hình đăng nhập Google");
}

async function saveUploadedImage(file: File, prefix: string): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 2 * 1024 * 1024) return null;
  const okTypes: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg", "image/gif": "gif", "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico" };
  const ext = okTypes[file.type];
  if (!ext) return null;
  const { mkdir, writeFile } = await import("node:fs/promises");
  const pathMod = await import("node:path");
  const dir = pathMod.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const name = `${prefix}-${Date.now()}.${ext}`;
  await writeFile(pathMod.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}

export async function saveContactWidgetAction(formData: FormData) {
  const admin = await requireOwner();
  const id = parseInt(String(formData.get("id") ?? ""), 10) || 0;
  const name = String(formData.get("name") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();
  const sort = parseInt(String(formData.get("sort") ?? "0"), 10) || 0;
  if (!name || !link) backErr("/admin/widgets", "Kênh liên hệ cần có tên và liên kết");
  const uploaded = await saveUploadedImage(formData.get("imageFile") as File, "contact");
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const existing = id ? await prisma.contactWidget.findUnique({ where: { id } }) : null;
  const image = uploaded ?? (imageUrl || (existing ? existing.image : null));
  if (id) {
    await prisma.contactWidget.update({ where: { id }, data: { name, link, image, sort } });
    await audit(admin.id, "contact.update", name);
    back("/admin/widgets", `Đã lưu kênh ${name}`);
  }
  await prisma.contactWidget.create({ data: { name, link, image, sort } });
  await audit(admin.id, "contact.create", name);
  back("/admin/widgets", `Đã thêm kênh ${name}`);
}

export async function toggleContactWidgetAction(formData: FormData) {
  const admin = await requireOwner();
  const id = parseInt(String(formData.get("id") ?? ""), 10) || 0;
  const w = await prisma.contactWidget.findUnique({ where: { id } });
  if (!w) backErr("/admin/widgets", "Không tìm thấy kênh liên hệ");
  await prisma.contactWidget.update({ where: { id }, data: { active: !w.active } });
  await audit(admin.id, "contact.toggle", `${w.name} -> ${!w.active ? "hiện" : "ẩn"}`);
  back("/admin/widgets", `Đã ${!w.active ? "hiện" : "ẩn"} kênh ${w.name}`);
}

export async function deleteContactWidgetAction(formData: FormData) {
  const admin = await requireOwner();
  const id = parseInt(String(formData.get("id") ?? ""), 10) || 0;
  const w = await prisma.contactWidget.findUnique({ where: { id } });
  if (!w) backErr("/admin/widgets", "Không tìm thấy kênh liên hệ");
  await prisma.contactWidget.delete({ where: { id } });
  await audit(admin.id, "contact.delete", w.name);
  back("/admin/widgets", `Đã xoá kênh ${w.name}`);
}

export async function saveWebsiteInfoAction(formData: FormData) {
  const admin = await requireOwner();
  for (const key of ["site_name", "site_url", "support_email", "site_tagline", "admin_entry_url"]) {
    await setSetting(key, String(formData.get(key) ?? "").trim());
  }
  for (const kind of ["logo", "favicon"] as const) {
    const settingKey = kind === "logo" ? "logo_url" : "favicon_url";
    if (formData.get(`${kind}_clear`) === "1") { await setSetting(settingKey, ""); continue; }
    const file = formData.get(kind) as File | null;
    if (file && file.size > 0) {
      const url = await saveUploadedImage(file, kind);
      if (!url) backErr("/admin/website?tab=info", `File ${kind} không hợp lệ (ảnh PNG/JPG/WEBP/SVG/GIF/ICO, tối đa 2MB)`);
      await setSetting(settingKey, url ?? "");
    }
  }
  await audit(admin.id, "website.info.save", "");
  back("/admin/website?tab=info", "Đã lưu thông tin web");
}


export async function adminReplyTicketAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = parseInt(String(formData.get("ticketId") ?? ""), 10) || 0;
  const dest = `/admin/tickets/${id}`;
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  const t = await prisma.ticket.findUnique({ where: { id } });
  if (!t) backErr("/admin/tickets", "Không tìm thấy ticket");
  if (t.status === "CLOSED") backErr(dest, "Ticket đã đóng — mở lại trước khi trả lời");
  if (!body) backErr(dest, "Vui lòng nhập nội dung trả lời");
  await prisma.ticketMessage.create({ data: { ticketId: t.id, authorId: admin.id, fromStaff: true, body } });
  await prisma.ticket.update({ where: { id: t.id }, data: { status: "ANSWERED" } });
  const { notifyUser } = await import("@/lib/notify");
  await notifyUser(t.userId, "SUPPORT", "Hỗ trợ đã trả lời ticket của bạn", `${t.code} — ${t.subject}`, `/account/tickets/${t.code}`);
  await audit(admin.id, "ticket.reply", t.code);
  back(dest, "Đã gửi trả lời cho khách");
}

export async function adminTicketStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = parseInt(String(formData.get("ticketId") ?? ""), 10) || 0;
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "close" && kind !== "reopen") backErr(`/admin/tickets/${id}`, "Thao tác không hợp lệ");
  const t = await prisma.ticket.findUnique({ where: { id } });
  if (!t) backErr("/admin/tickets", "Không tìm thấy ticket");
  if (kind === "close") {
    await prisma.ticket.update({ where: { id }, data: { status: "CLOSED" } });
    await audit(admin.id, "ticket.close", t.code);
    back(`/admin/tickets/${id}`, "Đã đóng ticket");
  }
  await prisma.ticket.update({ where: { id }, data: { status: "OPEN" } });
  await audit(admin.id, "ticket.reopen", t.code);
  back(`/admin/tickets/${id}`, "Đã mở lại ticket");
}
