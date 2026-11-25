"use server";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { makeSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { buyPackage, newDepositCode } from "@/lib/orders";
import { buySteamTopup, STEAM_SLUG } from "@/lib/steam";
import { buySteamGift, GIFT_SLUG } from "@/lib/steamgift";
import { buyTelegram, TG_SLUG } from "@/lib/telegram";
import { parseMoneyToCents, fmtUSD } from "@/lib/money";
import { audit } from "@/lib/settings";

async function setSession(userId: number, role: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, makeSessionToken(userId, role), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 24 * 3600,
  });
}


async function captureCreatorAttribution(userId: number) {
  try {
    const jar = await cookies();
    const code = jar.get("tp_ref")?.value;
    if (!code) return;
    const { prisma } = await import("@/lib/db");
    const link = await prisma.creatorLink.findUnique({ where: { code }, select: { id: true, creatorId: true, active: true, creator: { select: { status: true } } } });
    if (link && link.active && link.creator.status === "ACTIVE") {
      const { setAttribution } = await import("@/lib/creator");
      await setAttribution(userId, link.creatorId, link.id, "LINK");
    }
  } catch {   }
}

function formClientRef(formData: FormData): string | undefined {
  const raw = String(formData.get("clientRef") ?? "");
  return /^[A-Za-z0-9_-]{4,64}$/.test(raw) ? raw : undefined;
}

const AGREE_ERR = "Bạn cần tích vào ô đồng ý với Điều khoản dịch vụ và Chính sách bảo mật";

async function finishRegistration(name: string, email: string, passwordHash: string, refRaw: string): Promise<never> {
  let referredById: number | null = null;
  const refMatch = /^KH(\d+)$/i.exec(refRaw.trim());
  if (refMatch) {
    const referrer = await prisma.user.findUnique({ where: { id: parseInt(refMatch[1], 10) }, select: { id: true } });
    if (referrer) referredById = referrer.id;
  }
  const user = await prisma.user.create({
    data: { name, email, passwordHash, referredById },
  });
  if (referredById) {
    try {
      const { ensureLegacyCreator, setAttribution } = await import("@/lib/creator");
      const legacy = await ensureLegacyCreator(referredById);
      if (legacy) {
        const khLink = await prisma.creatorLink.findUnique({ where: { code: `KH${referredById}` }, select: { id: true } });
        await setAttribution(user.id, legacy.id, khLink?.id ?? null, "LINK");
      }
    } catch { /* attribution là phụ — không chặn đăng ký */ }
  }
  await setSession(user.id, user.role);
  await captureCreatorAttribution(user.id);
  redirect("/account?msg=" + encodeURIComponent("Đăng ký thành công"));
}

export async function registerAction(formData: FormData) {
  if (String(formData.get("agree") ?? "") !== "1") {
    redirect("/?auth=register&err=" + encodeURIComponent(AGREE_ERR));
  }
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (name.length < 2) redirect("/?auth=register&err=" + encodeURIComponent("Tên quá ngắn"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/?auth=register&err=" + encodeURIComponent("Email không hợp lệ"));
  if (password.length < 8) redirect("/?auth=register&err=" + encodeURIComponent("Mật khẩu tối thiểu 8 ký tự"));
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) redirect("/?auth=register&err=" + encodeURIComponent("Email đã được đăng ký"));
  const passwordHash = await bcrypt.hash(password, 10);
  const refRaw = String(formData.get("ref") ?? "");
  const { isMailConfigured, sendCodeEmail } = await import("@/lib/mailer");
  if (await isMailConfigured()) {
    const { issueEmailCode } = await import("@/lib/emailcodes");
    const issued = await issueEmailCode(email, "REGISTER", JSON.stringify({ name, passwordHash, ref: refRaw }));
    if ("cooldown" in issued) {
      redirect(`/?auth=verify&email=${encodeURIComponent(email)}&err=${encodeURIComponent("Mã vừa được gửi — chờ 60 giây nếu muốn gửi lại")}`);
    }
    if ("error" in issued) redirect("/?auth=register&err=" + encodeURIComponent("Không tạo được mã xác nhận — thử lại sau"));
    const sent = await sendCodeEmail(email, issued.code, "REGISTER");
    if (!sent) redirect("/?auth=register&err=" + encodeURIComponent("Không gửi được email xác nhận — kiểm tra lại email hoặc thử lại sau"));
    redirect(`/?auth=verify&email=${encodeURIComponent(email)}&msg=${encodeURIComponent(`Đã gửi mã xác nhận 6 số tới ${email}`)}`);
  }
  return finishRegistration(name, email, passwordHash, refRaw);
}

export async function verifyRegisterAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "");
  const back = (err: string): never => redirect(`/?auth=verify&email=${encodeURIComponent(email)}&err=${encodeURIComponent(err)}`);
  const { verifyEmailCode, CODE_ERROR_TEXT } = await import("@/lib/emailcodes");
  const res = await verifyEmailCode(email, "REGISTER", code);
  if (!res.ok) back(CODE_ERROR_TEXT[res.reason]);
  const payloadJson = res.ok ? res.payload : "";
  let payload: { name?: string; passwordHash?: string; ref?: string } = {};
  try { payload = JSON.parse(payloadJson || "{}"); } catch { /* payload hỏng = coi như phiên hết hạn */ }
  const pName = payload.name ?? "";
  const pHash = payload.passwordHash ?? "";
  if (!pName || !pHash) back("Phiên xác nhận không còn hợp lệ — hãy đăng ký lại");
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) redirect("/?auth=login&err=" + encodeURIComponent("Email đã được đăng ký — hãy đăng nhập"));
  return finishRegistration(pName, email, pHash, payload.ref ?? "");
}

export async function loginAction(formData: FormData) {
  const next = String(formData.get("next") ?? "");
  const nextQ = next.startsWith("/") ? "&next=" + encodeURIComponent(next) : "";
  if (String(formData.get("agree") ?? "") !== "1") {
    redirect("/?auth=login&err=" + encodeURIComponent(AGREE_ERR) + nextQ);
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect("/?auth=login&err=" + encodeURIComponent("Email hoặc mật khẩu không đúng") + nextQ);
  }
  await setSession(user.id, user.role);
  await captureCreatorAttribution(user.id);
  redirect(next.startsWith("/") ? next : "/account");
}

export async function forgotPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/?auth=forgot&err=" + encodeURIComponent("Email không hợp lệ"));
  }
  const { isMailConfigured, sendCodeEmail } = await import("@/lib/mailer");
  if (!(await isMailConfigured())) {
    redirect("/?auth=forgot&err=" + encodeURIComponent("Tính năng đặt lại mật khẩu qua email chưa được bật — liên hệ hỗ trợ để được giúp"));
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const { issueEmailCode } = await import("@/lib/emailcodes");
    const issued = await issueEmailCode(email, "RESET");
    if ("code" in issued) {
      const sent = await sendCodeEmail(email, issued.code, "RESET");
      if (!sent) redirect("/?auth=forgot&err=" + encodeURIComponent("Không gửi được email lúc này — thử lại sau"));
    }
  }
  redirect(`/?auth=reset&email=${encodeURIComponent(email)}&msg=${encodeURIComponent("Nếu email có tài khoản, mã xác nhận 6 số đã được gửi tới hộp thư của bạn")}`);
}

export async function resetPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const back = (err: string): never => redirect(`/?auth=reset&email=${encodeURIComponent(email)}&err=${encodeURIComponent(err)}`);
  if (password.length < 8) back("Mật khẩu tối thiểu 8 ký tự");
  if (password !== confirm) back("Mật khẩu nhập lại không khớp");
  const user = await prisma.user.findUnique({ where: { email } });
  const userId = user?.id ?? 0;
  if (!userId) back("Mã xác nhận không đúng");
  const { verifyEmailCode, CODE_ERROR_TEXT } = await import("@/lib/emailcodes");
  const res = await verifyEmailCode(email, "RESET", code);
  if (!res.ok) back(CODE_ERROR_TEXT[res.reason]);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  redirect("/?auth=login&msg=" + encodeURIComponent("Đặt lại mật khẩu thành công — đăng nhập bằng mật khẩu mới"));
}

export async function resendCodeAction(formData: FormData) {
  const purposeRaw = String(formData.get("purpose") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const purpose = purposeRaw === "reset" ? "RESET" : "REGISTER";
  const mode = purpose === "RESET" ? "reset" : "verify";
  const back = (params: string): never => redirect(`/?auth=${mode}&email=${encodeURIComponent(email)}&${params}`);
  const { isMailConfigured, sendCodeEmail } = await import("@/lib/mailer");
  if (!(await isMailConfigured())) back(`err=${encodeURIComponent("Chưa cấu hình gửi email")}`);
  const { issueEmailCode, peekEmailCodePayload } = await import("@/lib/emailcodes");
  let payload = "";
  if (purpose === "REGISTER") {
    payload = (await peekEmailCodePayload(email, "REGISTER")) ?? "";
    if (!payload) back(`err=${encodeURIComponent("Phiên xác nhận đã hết — hãy đăng ký lại")}`);
  } else {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) back(`msg=${encodeURIComponent("Nếu email có tài khoản, mã mới đã được gửi")}`);
  }
  const issued = await issueEmailCode(email, purpose, payload);
  if ("cooldown" in issued) back(`err=${encodeURIComponent("Mã vừa được gửi — chờ 60 giây rồi hãy gửi lại")}`);
  if ("error" in issued) back(`err=${encodeURIComponent("Không tạo được mã — thử lại sau")}`);
  const sent = await sendCodeEmail(email, (issued as { code: string }).code, purpose);
  if (!sent) back(`err=${encodeURIComponent("Không gửi được email lúc này — thử lại sau")}`);
  back(`msg=${encodeURIComponent("Đã gửi lại mã xác nhận 6 số")}`);
}

export async function adminLoginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || (user.role !== "ADMIN" && user.role !== "STAFF") || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect("/admin/login?err=" + encodeURIComponent("Email hoặc mật khẩu quản trị không đúng"));
  }
  await setSession(user.id, user.role);
  await captureCreatorAttribution(user.id);
  redirect("/admin");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  redirect("/");
}

export async function buyAction(formData: FormData) {
  const user = await getCurrentUser();
  const packageId = Number(formData.get("packageId"));
  if (!user) redirect(`/login?next=/game/${String(formData.get("slug") ?? "")}`);
  const fields: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("field_")) fields[k.slice(6)] = String(v);
  }
  try {
    const order = await buyPackage({
      userId: user.id,
      packageId,
      qty: Number(formData.get("qty") ?? 1),
      fields,
      promoCode: String(formData.get("promo") ?? "") || undefined,
      clientRef: formClientRef(formData),
      usePoints: parseInt(String(formData.get("usePoints") ?? "0"), 10) || 0,
    });
    redirect(`/account/orders?msg=${encodeURIComponent("Đặt đơn " + order.code + " thành công")}`);
  } catch (e) {
    unstable_rethrow(e); 
    const msg = e instanceof Error ? e.message : "BUY_FAILED";
    const friendly =
      msg === "INSUFFICIENT_BALANCE" ? "Số dư ví không đủ — hãy nạp thêm ví" :
      msg === "PACKAGE_UNAVAILABLE" ? "Gói nạp đang tắt hoặc hết bán" :
      msg === "PROMO_INVALID" ? "Mã giảm giá không hợp lệ hoặc đã hết lượt" :
      msg === "FLASH_SOLD_OUT" ? "Gói Flash Sale vừa hết suất khuyến mãi — vui lòng thử lại với giá thường" :
      msg.startsWith("MISSING_FIELD:") ? `Thiếu trường bắt buộc: ${msg.slice(13)}` :
      "Mua không thành công, vui lòng thử lại";
    redirect(`/game/${String(formData.get("slug") ?? "")}?err=${encodeURIComponent(friendly)}`);
  }
}

export async function buySteamAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/game/${STEAM_SLUG}`);
  const login = String(formData.get("steamLogin") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const back = (err: string): never => redirect(`/game/${STEAM_SLUG}?err=${encodeURIComponent(err)}`);
  if (!login) return back("Nhập Steam login của tài khoản nhận nạp");
  const am = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amountRaw);
  if (!am) return back("Số tiền nạp không hợp lệ — nhập số đô la, được lẻ tối đa 2 chữ số thập phân (ví dụ 10.50)");
  const amountCents = parseInt(am[1]) * 100 + parseInt((am[2] || "0").padEnd(2, "0"));
  try {
    const order = await buySteamTopup({ userId: user.id, login, amountCents, clientRef: formClientRef(formData) });
    redirect(`/account/orders?msg=${encodeURIComponent("Đặt đơn " + order.code + " thành công")}`);
  } catch (e) {
    unstable_rethrow(e);
    const msg = e instanceof Error ? e.message : "BUY_FAILED";
    const friendly =
      msg === "INSUFFICIENT_BALANCE" ? "Số dư ví không đủ — hãy nạp thêm ví" :
      msg === "STEAM_LOGIN_REQUIRED" ? "Nhập Steam login của tài khoản nhận nạp" :
      msg === "STEAM_AMOUNT_INVALID" ? "Số tiền nạp ngoài khoảng cho phép mỗi lần" :
      msg === "STEAM_UNAVAILABLE" ? "Dịch vụ nạp Steam đang tắt hoặc chưa khả dụng" :
      "Mua không thành công, vui lòng thử lại";
    back(friendly);
  }
}

export async function buySteamGiftAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/game/${GIFT_SLUG}`);
  const back = (err: string): never => redirect(`/game/${GIFT_SLUG}?err=${encodeURIComponent(err)}`);
  const appid = parseInt(String(formData.get("appid") ?? ""), 10);
  const subId = String(formData.get("subId") ?? "").trim().slice(0, 32);
  const region = String(formData.get("region") ?? "").trim().slice(0, 32);
  const inviteUrl = String(formData.get("invite") ?? "").trim();
  if (!Number.isInteger(appid) || appid <= 0) return back("Chọn game Steam cần tặng trước");
  if (!subId || !region) return back("Chọn phiên bản và khu vực cửa hàng trước");
  if (inviteUrl.length < 8) return back("Dán link mời Steam của tài khoản nhận quà");
  try {
    const order = await buySteamGift({ userId: user.id, appid, subId, region, inviteUrl, clientRef: formClientRef(formData) });
    redirect(`/account/orders?msg=${encodeURIComponent("Đặt đơn " + order.code + " thành công — quà đang được gửi tới tài khoản Steam nhận")}`);
  } catch (e) {
    unstable_rethrow(e);
    const msg = e instanceof Error ? e.message : "BUY_FAILED";
    const friendly =
      msg === "INSUFFICIENT_BALANCE" ? "Số dư ví không đủ — hãy nạp thêm ví" :
      msg === "GIFT_INVITE_REQUIRED" ? "Dán link mời Steam của tài khoản nhận quà" :
      msg === "GIFT_OFFER_GONE" ? "Phiên bản/vùng bạn chọn vừa hết offer phía nhà cung cấp — hãy chọn lại" :
      msg === "GIFT_OFFER_INVALID" ? "Lựa chọn game/phiên bản chưa hợp lệ" :
      msg === "GIFT_GAME_UNAVAILABLE" ? "Game này hiện không còn bán dạng quà tặng" :
      msg === "GIFT_UNAVAILABLE" ? "Dịch vụ tặng game Steam đang tắt hoặc chưa khả dụng" :
      "Mua không thành công, vui lòng thử lại";
    back(friendly);
  }
}

export async function buyTelegramAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/game/${TG_SLUG}`);
  const back = (err: string): never => redirect(`/game/${TG_SLUG}?err=${encodeURIComponent(err)}`);
  const kind = String(formData.get("kind") ?? "") === "premium" ? "premium" : "stars";
  const itemKey = String(formData.get("itemKey") ?? "").trim().slice(0, 16);
  const quantity = parseInt(String(formData.get("quantity") ?? "1"), 10);
  const username = String(formData.get("username") ?? "").trim();
  if (!itemKey) return back("Chọn gói trước");
  if (!username) return back("Nhập username Telegram của tài khoản nhận");
  try {
    const order = await buyTelegram({ userId: user.id, kind, itemKey, quantity: Number.isInteger(quantity) ? quantity : 1, username, clientRef: formClientRef(formData) });
    redirect(`/account/orders?msg=${encodeURIComponent("Đặt đơn " + order.code + " thành công — Telegram đang được gửi tới tài khoản nhận")}`);
  } catch (e) {
    unstable_rethrow(e);
    const msg = e instanceof Error ? e.message : "BUY_FAILED";
    const friendly =
      msg === "INSUFFICIENT_BALANCE" ? "Số dư ví không đủ — hãy nạp thêm ví" :
      msg === "TG_USERNAME_INVALID" ? "Username Telegram chưa đúng — nhập dạng @username (5–32 ký tự, chỉ chữ/số/gạch dưới)" :
      msg === "TG_STARS_RANGE" ? "Số sao nằm ngoài khoảng nhà cung cấp cho phép — hãy chọn gói khác" :
      msg === "TG_PACKAGE_UNAVAILABLE" ? "Gói bạn chọn hiện không còn bán — hãy chọn gói khác" :
      msg === "TG_QTY_INVALID" ? "Số lượng chưa hợp lệ" :
      msg === "TG_UNAVAILABLE" ? "Dịch vụ Telegram đang tắt hoặc chưa khả dụng" :
      "Mua không thành công, vui lòng thử lại";
    back(friendly);
  }
}

export async function createDepositAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=login&next=/account/deposit");
  const method = String(formData.get("method") ?? "");
  const fail = (m: string): never => redirect("/account/deposit?err=" + encodeURIComponent(m));
  const { getSepayConfig, getBntpayConfig, currentVndRate, usdToVnd, bntpayCreateOrder, BntpayError } = await import("@/lib/gateways");

  const rawVnd = String(formData.get("amountVnd") ?? "").replace(/\D/g, "");
  let cents = 0;
  let vndAmount: number | null = null;
  if (rawVnd) {
    const vnd = parseInt(rawVnd, 10) || 0;
    const { getSettings } = await import("@/lib/settings");
    const st = await getSettings();
    const minVnd = parseInt(st.deposit_min_vnd ?? "", 10) || 130000;
    const maxVnd = parseInt(st.deposit_max_vnd ?? "", 10) || 13000000;
    if (vnd < minVnd) fail(`Số tiền nạp tối thiểu ₫${minVnd.toLocaleString("vi-VN")}`);
    if (vnd > maxVnd) fail(`Số tiền nạp tối đa ₫${maxVnd.toLocaleString("vi-VN")}`);
    const rate = await currentVndRate();
    if (!rate) fail("Chưa có tỉ giá VNĐ — vui lòng liên hệ hỗ trợ");
    cents = Math.round((vnd / rate) * 100);
    if (cents < 100) fail("Số tiền nạp quá nhỏ");
    vndAmount = vnd;
  } else {
    cents = parseMoneyToCents(String(formData.get("amount") ?? "")) ?? 0;
    if (cents < 1000) fail("Số tiền nạp tối thiểu $10.00");
  }

  if (method === "SEPAY") {
    const cfg = await getSepayConfig();
    if (!cfg.enabled) fail("Cổng SePay chưa sẵn sàng — vui lòng chọn cổng khác");
    if (vndAmount == null) {
      const rate = await currentVndRate();
      if (!rate) fail("Chưa có tỉ giá VNĐ — vui lòng liên hệ hỗ trợ");
      vndAmount = usdToVnd(cents, rate);
    }
  } else if (method === "BNTPAY") {
    const cfg = await getBntpayConfig();
    if (!cfg.enabled) fail("Cổng BNT Pay chưa sẵn sàng — vui lòng chọn cổng khác");
  } else {
    fail("Cổng nạp không hợp lệ");
  }

  const created = await prisma.depositRequest.create({
    data: { code: "TMP", userId: user.id, amountCents: cents, method, vndAmount },
  });
  const code = newDepositCode(created.id);
  await prisma.depositRequest.update({ where: { id: created.id }, data: { code } });
  await audit(user.id, "deposit.create", `${code} ${cents} ${method}`);

  if (method === "BNTPAY") {
    const cfg = await getBntpayConfig();
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost"}`;
    try {
      const order = await bntpayCreateOrder(cfg, { externalOrderId: code, amountUsd: cents / 100, origin });
      await prisma.depositRequest.update({
        where: { id: created.id },
        data: { providerData: JSON.stringify({ externalOrderId: code, network: cfg.network, ...order }) },
      });
      if (order.checkoutUrl) redirect(order.checkoutUrl);
    } catch (e) {
      unstable_rethrow(e); 
      const msg = e instanceof BntpayError ? e.message : "Không tạo được đơn BNT Pay";
      await prisma.depositRequest.update({ where: { id: created.id }, data: { status: "REJECTED", decidedAt: new Date(), note: msg } });
      fail("BNT Pay: " + msg);
    }
  }
  redirect(`/account/deposit/${code}`);
}

export async function toggleHelpfulAction(formData: FormData) {
  const backRaw = String(formData.get("back") ?? "");
  const dest = /^\/game\/[a-z0-9-]+$/i.test(backRaw) ? backRaw : "/";
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=login&next=" + encodeURIComponent(dest));
  const reviewId = parseInt(String(formData.get("reviewId") ?? ""), 10) || 0;
  if (!reviewId) redirect(dest);
  const existing = await prisma.reviewVote.findUnique({ where: { reviewId_userId: { reviewId, userId: user.id } } });
  if (existing) {
    await prisma.$transaction([
      prisma.reviewVote.delete({ where: { id: existing.id } }),
      prisma.review.update({ where: { id: reviewId }, data: { helpfulCount: { decrement: 1 } } }),
    ]);
  } else {
    const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { id: true } });
    if (review) {
      await prisma.$transaction([
        prisma.reviewVote.create({ data: { reviewId, userId: user.id } }),
        prisma.review.update({ where: { id: reviewId }, data: { helpfulCount: { increment: 1 } } }),
      ]);
    }
  }
  redirect(dest + "#reviews");
}

export async function reviewOrderAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=login&next=/account/orders");
  const backRaw = String(formData.get("back") ?? "");
  const dest = /^\/game\/[a-z0-9-]+$/i.test(backRaw) ? backRaw : "/account/orders";
  const fail = (m: string): never => redirect(dest + "?err=" + encodeURIComponent(m));
  const orderId = parseInt(String(formData.get("orderId") ?? ""), 10) || 0;
  const stars = Math.min(5, Math.max(1, parseInt(String(formData.get("stars") ?? ""), 10) || 0));
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 500) || null;
  if (!orderId || !stars) fail("Vui lòng chọn số sao cho đơn hàng");
  const found = await prisma.order.findFirst({ where: { id: orderId, userId: user.id } });
  if (!found) redirect(dest + "?err=" + encodeURIComponent("Không tìm thấy đơn hàng"));
  const order = found;
  if (order.status !== "DELIVERED") fail("Chỉ đánh giá được đơn đã giao");
  const existing = await prisma.review.findUnique({ where: { orderId } });
  if (existing) fail("Đơn này đã được đánh giá rồi");
  const { pointsConfig, awardReviewPoints } = await import("@/lib/points");
  const cfg = await pointsConfig();
  let awarded = 0;
  await prisma.$transaction(async (tx) => {
    awarded = await awardReviewPoints(tx, user.id, order.code, cfg);
    await tx.review.create({
      data: { userId: user.id, orderId, gameId: order.gameId, stars, comment, pointsAwarded: awarded },
    });
    const game = await tx.game.findUnique({ where: { id: order.gameId }, select: { ratingAvg: true, ratingCount: true } });
    if (game) {
      const newCount = game.ratingCount + 1;
      const newAvg = Math.round(((game.ratingAvg * game.ratingCount + stars) / newCount) * 10) / 10;
      await tx.game.update({ where: { id: order.gameId }, data: { ratingAvg: newAvg, ratingCount: newCount } });
    }
  });
  await audit(user.id, "review.create", `${order.code} ${stars}* +${awarded}đ`);
  redirect(dest + "?msg=" + encodeURIComponent(awarded > 0 ? `Cảm ơn bạn đã đánh giá! Bạn nhận +${awarded} điểm.` : "Cảm ơn bạn đã đánh giá! (Đã hết lượt nhận điểm hôm nay)"));
}

export async function updateNameAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=login&next=/account");
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (name.length < 2) redirect("/account?err=" + encodeURIComponent("Tên quá ngắn"));
  await prisma.user.update({ where: { id: user.id }, data: { name } });
  await audit(user.id, "profile.rename", name);
  redirect("/account");
}

export async function checkBntpayStatusAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=login&next=/account/deposit");
  const code = String(formData.get("code") ?? "");
  const dep = await prisma.depositRequest.findFirst({ where: { code, userId: user.id, method: "BNTPAY" } });
  if (!dep) redirect("/account/deposit");
  const { pollBntpayDeposit } = await import("@/lib/gateways");
  const r = await pollBntpayDeposit(dep.id).catch(() => ({ ok: false, reason: "gateway_error" }));
  const fresh = await prisma.depositRequest.findUnique({ where: { id: dep.id } });
  if (fresh?.status === "APPROVED") redirect(`/account/deposit/${code}?msg=${encodeURIComponent("Đã cộng tiền vào ví")}`);
  if (fresh?.status === "REJECTED") redirect(`/account/deposit/${code}?err=${encodeURIComponent("Đơn BNT Pay đã hết hạn hoặc thất bại")}`);
  redirect(`/account/deposit/${code}?msg=${encodeURIComponent("Chưa thấy thanh toán hoàn tất — trạng thái cổng: " + r.reason)}`);
}

export async function markNotificationsReadAction() {
  const user = await getCurrentUser();
  if (!user) return;
  const { markAllRead } = await import("@/lib/notify");
  await markAllRead(user.id);
}

export async function setPrefsAction(formData: FormData) {
  const lang = String(formData.get("lang") ?? "");
  const cur = String(formData.get("cur") ?? "");
  const next = String(formData.get("next") ?? "/");
  const jar = await cookies();
  if (lang === "vi" || lang === "en") jar.set("tp_lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  if (/^[A-Z]{3}$/.test(cur)) jar.set("tp_cur", cur, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect(next.startsWith("/") ? next : "/");
}


export async function createTicketAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=login&next=/support");
  const fail = (m: string): never => redirect("/support?err=" + encodeURIComponent(m));
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 120);
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  const orderCode = String(formData.get("orderCode") ?? "").trim().slice(0, 40);
  if (subject.length < 3) fail("Vui lòng nhập chủ đề (ít nhất 3 ký tự)");
  if (!body) fail("Vui lòng nhập nội dung cần hỗ trợ");
  let validOrder: string | null = null;
  if (orderCode) {
    const o = await prisma.order.findFirst({ where: { code: orderCode, userId: user.id }, select: { code: true } });
    if (!o) redirect("/support?err=" + encodeURIComponent("Không tìm thấy đơn hàng này trong tài khoản của bạn"));
    validOrder = o.code;
  }
  const { createTicket } = await import("@/lib/tickets");
  const t = await createTicket(user.id, subject, body, validOrder);
  await audit(user.id, "ticket.create", t.code);
  redirect(`/account/tickets/${t.code}?msg=` + encodeURIComponent("Đã gửi yêu cầu hỗ trợ. Đội hỗ trợ sẽ trả lời tại đây."));
}

export async function replyTicketAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=login&next=/support");
  const code = String(formData.get("code") ?? "");
  const back = `/account/tickets/${code}`;
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  const t = await prisma.ticket.findFirst({ where: { code, userId: user.id } });
  if (!t) redirect("/support?err=" + encodeURIComponent("Không tìm thấy ticket"));
  if (t.status === "CLOSED") redirect(back + "?err=" + encodeURIComponent("Ticket đã đóng, hãy tạo ticket mới nếu cần hỗ trợ thêm"));
  if (!body) redirect(back + "?err=" + encodeURIComponent("Vui lòng nhập nội dung trả lời"));
  await prisma.ticketMessage.create({ data: { ticketId: t.id, authorId: user.id, fromStaff: false, body } });
  await prisma.ticket.update({ where: { id: t.id }, data: { status: "OPEN" } });
  redirect(back + "?msg=" + encodeURIComponent("Đã gửi trả lời"));
}

export async function closeTicketAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=login");
  const code = String(formData.get("code") ?? "");
  const t = await prisma.ticket.findFirst({ where: { code, userId: user.id } });
  if (!t) redirect("/support?err=" + encodeURIComponent("Không tìm thấy ticket"));
  await prisma.ticket.update({ where: { id: t.id }, data: { status: "CLOSED" } });
  await audit(user.id, "ticket.close", code);
  redirect(`/account/tickets/${code}?msg=` + encodeURIComponent("Đã đóng ticket"));
}
