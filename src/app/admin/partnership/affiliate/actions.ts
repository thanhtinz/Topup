"use server";

import { redirect } from "next/navigation";
import { unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin, requireOwner } from "@/lib/auth";
import { audit, setSetting } from "@/lib/settings";
import { creatorConfig, markPayoutPaid } from "@/lib/creator";
import { notifyUser } from "@/lib/notify";
import { fmtUSD } from "@/lib/money";

function back(path: string, msg?: string, err?: string): never {
  const q = err ? `?err=${encodeURIComponent(err)}` : msg ? `?msg=${encodeURIComponent(msg)}` : "";
  redirect(path + q);
}

export async function updateCreatorAction(formData: FormData) {
  const admin = await requireOwner();
  const id = Number(formData.get("id"));
  const creator = await prisma.creator.findUnique({ where: { id } });
  if (!creator) back("/admin/partnership/affiliate", undefined, "Không tìm thấy Affiliate");
  const levelId = Number(formData.get("levelId") ?? 0) || null;
  const customRaw = String(formData.get("customRate") ?? "").trim();
  const customRateBps = customRaw === "" ? null : Math.round(parseFloat(customRaw) * 100);
  if (customRateBps !== null && (!Number.isFinite(customRateBps) || customRateBps < 0 || customRateBps > 10000)) {
    back(`/admin/partnership/affiliate/${id}`, undefined, "Tỉ lệ riêng không hợp lệ (0–100%)");
  }
  const tier = String(formData.get("tier") ?? "CREATOR");
  const status = String(formData.get("status") ?? "ACTIVE");
  await prisma.creator.update({
    where: { id },
    data: {
      displayName: String(formData.get("displayName") ?? creator.displayName).trim().slice(0, 120) || creator.displayName,
      levelId,
      customRateBps,
      tier: ["CREATOR", "VERIFIED", "OFFICIAL"].includes(tier) ? tier : "CREATOR",
      status: status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
    },
  });
  if (status === "SUSPENDED" && creator.status !== "SUSPENDED") {
    await notifyUser(creator.userId, "CREATOR", "Tài khoản Affiliate bị tạm khóa", "Tài khoản Affiliate của bạn tạm thời bị khóa. Liên hệ BNTGame để biết thêm chi tiết.", "/creator/dashboard");
  }
  await audit(admin.id, "creator.update", `${creator.code}: level=${levelId} rate=${customRateBps} tier=${tier} status=${status}`);
  back(`/admin/partnership/affiliate/${id}`, "Đã lưu Affiliate");
}

export async function addAdjustmentAction(formData: FormData) {
  const admin = await requireOwner();
  const creatorId = Number(formData.get("creatorId"));
  const amountUsd = parseFloat(String(formData.get("amount") ?? "0"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (!Number.isFinite(amountUsd) || amountUsd === 0 || !reason) back(`/admin/partnership/affiliate/${creatorId}`, undefined, "Điều chỉnh cần số tiền khác 0 và lý do rõ ràng");
  const adj = await prisma.creatorAdjustment.create({ data: { creatorId, amountCents: Math.round(amountUsd * 100), reason, adminId: admin.id } });
  await audit(admin.id, "creator.adjustment", `${creatorId}: ${adj.amountCents} — ${reason}`);
  back(`/admin/partnership/affiliate/${creatorId}`, "Đã ghi điều chỉnh số dư");
}

export async function createCreatorCouponAction(formData: FormData) {
  const admin = await requireOwner();
  const creatorId = Number(formData.get("creatorId"));
  const code = String(formData.get("code") ?? "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const percent = parseInt(String(formData.get("percent") ?? "0"), 10);
  if (!code || percent <= 0 || percent > 90) back(`/admin/partnership/affiliate/${creatorId}`, undefined, "Mã hoặc % giảm không hợp lệ");
  const exists = await prisma.discountCode.findUnique({ where: { code } });
  if (exists) back(`/admin/partnership/affiliate/${creatorId}`, undefined, "Mã đã tồn tại");
  const maxDiscount = parseFloat(String(formData.get("maxDiscount") ?? "0"));
  const minOrder = parseFloat(String(formData.get("minOrder") ?? "0"));
  const maxUses = parseInt(String(formData.get("maxUses") ?? "0"), 10);
  const expiresRaw = String(formData.get("expiresAt") ?? "");
  await prisma.discountCode.create({
    data: {
      code,
      percent,
      creatorId,
      maxDiscountCents: maxDiscount > 0 ? Math.round(maxDiscount * 100) : null,
      minOrderCents: minOrder > 0 ? Math.round(minOrder * 100) : null,
      maxUses: maxUses > 0 ? maxUses : null,
      expiresAt: expiresRaw ? new Date(expiresRaw) : null,
    },
  });
  const creator = await prisma.creator.findUnique({ where: { id: creatorId }, select: { userId: true } });
  if (creator) await notifyUser(creator.userId, "CREATOR", "Bạn được cấp mã giảm giá riêng", `Mã ${code} giảm ${percent}% đã sẵn sàng cho khách của bạn.`, "/creator/coupons");
  await audit(admin.id, "creator.coupon.create", `${code} ${percent}% -> creator ${creatorId}`);
  back(`/admin/partnership/affiliate/${creatorId}`, `Đã tạo mã ${code}`);
}

export async function toggleCouponAction(formData: FormData) {
  const admin = await requireOwner();
  const id = Number(formData.get("id"));
  const creatorId = Number(formData.get("creatorId"));
  const c = await prisma.discountCode.findUnique({ where: { id } });
  if (c) {
    await prisma.discountCode.update({ where: { id }, data: { active: !c.active } });
    await audit(admin.id, "creator.coupon.toggle", `${c.code} -> ${!c.active}`);
  }
  back(`/admin/partnership/affiliate/${creatorId}`);
}

export async function saveLevelAction(formData: FormData) {
  const admin = await requireOwner();
  const id = Number(formData.get("id") ?? 0);
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const rateBps = Math.round(parseFloat(String(formData.get("rate") ?? "0")) * 100);
  const minRevenue = Math.round(parseFloat(String(formData.get("minRevenue") ?? "0")) * 100);
  if (!name || !Number.isFinite(rateBps) || rateBps < 0 || rateBps > 10000) back("/admin/partnership/affiliate/levels", undefined, "Dữ liệu cấp độ không hợp lệ");
  const data = { name, rateBps, minRevenue30dCents: Math.max(0, minRevenue || 0), color: String(formData.get("color") ?? "#0B63E5").slice(0, 12), sort: parseInt(String(formData.get("sort") ?? "0"), 10) || 0 };
  if (id) await prisma.creatorLevel.update({ where: { id }, data });
  else await prisma.creatorLevel.create({ data });
  await audit(admin.id, "creator.level.save", `${name} ${rateBps}bps`);
  back("/admin/partnership/affiliate/levels", "Đã lưu cấp độ");
}

export async function deleteLevelAction(formData: FormData) {
  const admin = await requireOwner();
  const id = Number(formData.get("id"));
  const used = await prisma.creator.count({ where: { levelId: id } });
  if (used > 0) back("/admin/partnership/affiliate/levels", undefined, `Còn ${used} Affiliate ở cấp này — không xoá được`);
  await prisma.creatorLevel.delete({ where: { id } });
  await audit(admin.id, "creator.level.delete", String(id));
  back("/admin/partnership/affiliate/levels", "Đã xoá cấp độ");
}

export async function decidePayoutAction(formData: FormData) {
  const admin = await requireOwner();
  const id = Number(formData.get("id"));
  const kind = String(formData.get("kind") ?? "");
  if (!["approve", "process", "paid", "reject"].includes(kind)) back("/admin/partnership/affiliate/payouts", undefined, "Thao tác tiền không rõ ràng — đã chặn");
  const p = await prisma.creatorPayout.findUnique({ where: { id }, include: { creator: { select: { userId: true } } } });
  if (!p) back("/admin/partnership/affiliate/payouts", undefined, "Không tìm thấy yêu cầu rút");
  const note = String(formData.get("reviewNote") ?? "").trim().slice(0, 300);
  try {
    if (kind === "approve") {
      await prisma.creatorPayout.update({ where: { id }, data: { status: "APPROVED", reviewNote: note || p.reviewNote, reviewedById: admin.id } });
      await notifyUser(p.creator.userId, "CREATOR", "Yêu cầu rút tiền đã được duyệt", `${fmtUSD(p.amountCents)} đang được xử lý thanh toán.`, "/creator/payouts");
    } else if (kind === "process") {
      await prisma.creatorPayout.update({ where: { id }, data: { status: "PROCESSING", reviewedById: admin.id } });
    } else if (kind === "reject") {
      if (p.status === "PAID") back("/admin/partnership/affiliate/payouts", undefined, "Đã thanh toán — không từ chối được");
      await prisma.creatorPayout.update({ where: { id }, data: { status: "REJECTED", reviewNote: note, reviewedById: admin.id } });
      await notifyUser(p.creator.userId, "CREATOR", "Yêu cầu rút tiền bị từ chối", note ? `Lý do: ${note}. Số dư đã được mở khoá lại.` : "Số dư đã được mở khoá lại.", "/creator/payouts");
    } else if (kind === "paid") {
      const txRef = String(formData.get("txRef") ?? "").trim();
      await markPayoutPaid(id, txRef, admin.id);
    }
    await audit(admin.id, "creator.payout." + kind, `${id}: ${p.amountCents}`);
  } catch (e) {
    unstable_rethrow(e);
    back("/admin/partnership/affiliate/payouts", undefined, "Xử lý thất bại: " + (e instanceof Error ? e.message : "lỗi"));
  }
  back("/admin/partnership/affiliate/payouts", "Đã cập nhật yêu cầu rút tiền");
}

export async function decideCommissionAction(formData: FormData) {
  const admin = await requireOwner();
  const id = Number(formData.get("id"));
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "reverse" && kind !== "restore") back("/admin/partnership/affiliate/commissions", undefined, "Thao tác không rõ ràng — đã chặn");
  const c = await prisma.creatorCommission.findUnique({ where: { id } });
  if (!c) back("/admin/partnership/affiliate/commissions", undefined, "Không tìm thấy khoản hoa hồng");
  if (kind === "reverse") {
    const { reverseCreatorCommissionForOrder } = await import("@/lib/creator");
    await reverseCreatorCommissionForOrder(c.orderId, admin.id);
    await audit(admin.id, "creator.commission.reverse", `${c.orderCode}: ${c.amountCents}`);
  } else {
    if (c.status !== "REVERSED") back("/admin/partnership/affiliate/commissions", undefined, "Chỉ khôi phục khoản đã thu hồi");
    await prisma.creatorCommission.update({ where: { id }, data: { status: "PENDING", availableAt: new Date() } });
    await audit(admin.id, "creator.commission.restore", `${c.orderCode}: ${c.amountCents}`);
  }
  back("/admin/partnership/affiliate/commissions", "Đã cập nhật hoa hồng");
}

export async function saveCampaignAction(formData: FormData) {
  const admin = await requireOwner();
  const id = Number(formData.get("id") ?? 0);
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
  const startAt = new Date(String(formData.get("startAt") ?? ""));
  const endAt = new Date(String(formData.get("endAt") ?? ""));
  if (!name || !slug || isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || endAt <= startAt) {
    back("/admin/partnership/affiliate/campaigns", undefined, "Tên/slug/khoảng thời gian chưa hợp lệ");
  }
  const data = {
    name, slug,
    description: String(formData.get("description") ?? "").trim().slice(0, 1000),
    bannerUrl: String(formData.get("bannerUrl") ?? "").trim().slice(0, 400),
    startAt, endAt,
    bonusBps: Math.round(parseFloat(String(formData.get("bonus") ?? "0")) * 100) || 0,
    budgetCents: Math.round(parseFloat(String(formData.get("budget") ?? "0")) * 100) || 0,
    status: String(formData.get("status") ?? "DRAFT"),
  };
  if (id) await prisma.creatorCampaign.update({ where: { id }, data });
  else await prisma.creatorCampaign.create({ data });
  await audit(admin.id, "creator.campaign.save", `${slug}`);
  back("/admin/partnership/affiliate/campaigns", "Đã lưu chiến dịch");
}

export async function decideJoinAction(formData: FormData) {
  const admin = await requireOwner();
  const id = Number(formData.get("id"));
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "approve" && kind !== "reject") back("/admin/partnership/affiliate/campaigns", undefined, "Thao tác không rõ ràng — đã chặn");
  const join = await prisma.creatorCampaignJoin.update({ where: { id }, data: { status: kind === "approve" ? "APPROVED" : "REJECTED" }, include: { creator: { select: { userId: true } }, campaign: { select: { name: true } } } });
  await notifyUser(join.creator.userId, "CREATOR", kind === "approve" ? "Đã duyệt tham gia chiến dịch" : "Đăng ký chiến dịch bị từ chối", `Chiến dịch ${join.campaign.name}.`, "/creator/campaigns");
  await audit(admin.id, "creator.campaign.join." + kind, String(id));
  back("/admin/partnership/affiliate/campaigns", "Đã cập nhật đăng ký chiến dịch");
}

export async function saveMediaAction(formData: FormData) {
  const admin = await requireOwner();
  const id = Number(formData.get("id") ?? 0);
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const fileUrl = String(formData.get("fileUrl") ?? "").trim().slice(0, 500);
  if (!title || !fileUrl) back("/admin/partnership/affiliate/media", undefined, "Thiếu tiêu đề hoặc URL file");
  const data = {
    title,
    description: String(formData.get("description") ?? "").trim().slice(0, 400),
    fileUrl,
    fileType: String(formData.get("fileType") ?? "IMAGE"),
    category: String(formData.get("category") ?? "").trim().slice(0, 60),
    active: String(formData.get("active") ?? "1") === "1",
  };
  if (id) await prisma.creatorMediaAsset.update({ where: { id }, data });
  else await prisma.creatorMediaAsset.create({ data });
  await audit(admin.id, "creator.media.save", title);
  back("/admin/partnership/affiliate/media", "Đã lưu tài nguyên");
}

export async function deleteMediaAction(formData: FormData) {
  const admin = await requireOwner();
  const id = Number(formData.get("id"));
  await prisma.creatorMediaAsset.delete({ where: { id } });
  await audit(admin.id, "creator.media.delete", String(id));
  back("/admin/partnership/affiliate/media", "Đã xoá tài nguyên");
}

export async function saveCreatorSettingsAction(formData: FormData) {
  const admin = await requireOwner();
  const days = (k: string, dflt: number, min: number, max: number) => {
    const v = parseInt(String(formData.get(k) ?? ""), 10);
    return String(Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt);
  };
  await setSetting("creator_attribution_days", days("attributionDays", 30, 1, 365));
  await setSetting("creator_hold_days", days("holdDays", 7, 0, 90));
  await setSetting("creator_min_withdraw_cents", String(Math.max(0, Math.round(parseFloat(String(formData.get("minWithdraw") ?? "20")) * 100) || 0)));
  await setSetting("creator_max_links", days("maxLinks", 20, 1, 200));
  await setSetting("creator_terms_version", String(formData.get("termsVersion") ?? "1.0").trim().slice(0, 12) || "1.0");
  await setSetting("creator_ranking_public", String(formData.get("rankingPublic") ?? "") === "1" ? "1" : "0");
  const pctToBps = (k: string) => {
    const raw = String(formData.get(k) ?? "").trim();
    if (raw === "") return "";
    const v = parseFloat(raw);
    return Number.isFinite(v) ? String(Math.round(Math.min(100, Math.max(0, v)) * 100)) : "";
  };
  const capRaw = parseFloat(String(formData.get("maxRate") ?? "10"));
  await setSetting("creator_max_rate_bps", String(Math.round(Math.min(100, Math.max(0, Number.isFinite(capRaw) ? capRaw : 10)) * 100)));
  await setSetting("creator_rate_steam_topup_bps", pctToBps("rateSteamTopup"));
  await setSetting("creator_rate_telegram_bps", pctToBps("rateTelegram"));
  await setSetting("creator_rate_steam_gift_bps", pctToBps("rateSteamGift"));
  await setSetting("creator_rate_topup_fzr_bps", pctToBps("rateTopupFzr"));
  await setSetting("creator_rate_topup_eris_bps", pctToBps("rateTopupEris"));
  await audit(admin.id, "creator.settings", "cập nhật cấu hình Creator");
  back("/admin/partnership/affiliate/settings", "Đã lưu cài đặt Affiliate");
}
