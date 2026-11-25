"use server";

import { redirect } from "next/navigation";
import { unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { creatorConfig, getCreatorByUser, requestPayout } from "@/lib/creator";
import { getSettings } from "@/lib/settings";

function back(path: string, msg?: string, err?: string): never {
  const q = err ? `?err=${encodeURIComponent(err)}` : msg ? `?msg=${encodeURIComponent(msg)}` : "";
  redirect(path + q);
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=login");
  return user;
}

async function requireCreator() {
  const user = await requireUser();
  const creator = await getCreatorByUser(user.id);
  if (!creator) redirect("/partnership/apply?type=affiliate");
  return { user, creator };
}

const PLATFORMS = ["YouTube", "Twitch", "TikTok", "Facebook", "Instagram", "Kick", "Discord", "Other"];


export async function acceptTermsAction(formData: FormData) {
  const { creator } = await requireCreator();
  if (String(formData.get("agree") ?? "") !== "1") back("/creator/settings", undefined, "Bạn cần tick đồng ý điều khoản");
  const cfg = await creatorConfig();
  await prisma.creator.update({ where: { id: creator.id }, data: { agreementVersion: cfg.termsVersion, agreementAt: new Date() } });
  back("/creator/settings", `Đã chấp nhận điều khoản Creator phiên bản ${cfg.termsVersion}`);
}

export async function createLinkAction(formData: FormData) {
  const { creator } = await requireCreator();
  const cfg = await creatorConfig();
  const count = await prisma.creatorLink.count({ where: { creatorId: creator.id } });
  if (count >= cfg.maxLinks) back("/creator/links", undefined, `Tối đa ${cfg.maxLinks} đường dẫn`);
  const name = String(formData.get("name") ?? "").trim().slice(0, 80) || "Link";
  const destType = String(formData.get("destType") ?? "home");
  let destination = "/";
  if (destType === "games") destination = "/games";
  if (destType === "game") {
    const slug = String(formData.get("gameSlug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    const game = slug ? await prisma.game.findUnique({ where: { slug }, select: { id: true } }) : null;
    if (!game) back("/creator/links", undefined, "Không tìm thấy game với slug đó");
    destination = `/game/${slug}`;
  }
  const suffix = String(formData.get("suffix") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24);
  const code = suffix ? `${creator.code}-${suffix}`.toUpperCase() : `${creator.code}-${count + 1}`;
  const dup = await prisma.creatorLink.findUnique({ where: { code } });
  if (dup) back("/creator/links", undefined, "Mã link đã tồn tại, chọn hậu tố khác");
  await prisma.creatorLink.create({ data: { creatorId: creator.id, code, name, destination } });
  back("/creator/links", "Đã tạo đường dẫn mới");
}

export async function toggleLinkAction(formData: FormData) {
  const { creator } = await requireCreator();
  const id = Number(formData.get("id"));
  const link = await prisma.creatorLink.findFirst({ where: { id, creatorId: creator.id } });
  if (link) await prisma.creatorLink.update({ where: { id }, data: { active: !link.active } });
  back("/creator/links");
}

export async function deleteLinkAction(formData: FormData) {
  const { creator } = await requireCreator();
  const id = Number(formData.get("id"));
  const link = await prisma.creatorLink.findFirst({ where: { id, creatorId: creator.id } });
  if (link && link.code !== creator.code) await prisma.creatorLink.delete({ where: { id } });
  back("/creator/links", "Đã xoá đường dẫn");
}

export async function requestPayoutAction(formData: FormData) {
  const user = await requireUser();
  if (String(formData.get("kind") ?? "") !== "payout") back("/creator/payouts", undefined, "Thao tác không rõ ràng — đã chặn");
  const amountUsd = parseFloat(String(formData.get("amount") ?? "0"));
  const amountCents = Math.round((Number.isFinite(amountUsd) ? amountUsd : 0) * 100);
  const method = String(formData.get("method") ?? "");
  const destination = String(formData.get("destination") ?? "");
  try {
    await requestPayout(user.id, amountCents, method, destination);
  } catch (e) {
    unstable_rethrow(e);
    const code = e instanceof Error ? e.message : "";
    const text =
      code === "PAYOUT_BELOW_MIN" ? "Chưa đạt mức rút tối thiểu" :
      code === "PAYOUT_INSUFFICIENT" ? "Số dư khả dụng không đủ" :
      code === "CREATOR_SUSPENDED" ? "Tài khoản Affiliate đang bị tạm khóa" :
      code === "CREATOR_TERMS_REQUIRED" ? "Bạn cần chấp nhận điều khoản Affiliate ở mục Hồ sơ trước khi rút tiền" :
      code === "CREATOR_DISABLED" ? "Chương trình Affiliate đang tắt" :
      "Thông tin rút tiền chưa hợp lệ";
    back("/creator/payouts", undefined, text);
  }
  back("/creator/payouts", "Đã gửi yêu cầu rút tiền, chờ admin xét duyệt");
}

export async function joinCampaignAction(formData: FormData) {
  const { creator } = await requireCreator();
  const campaignId = Number(formData.get("campaignId"));
  const campaign = await prisma.creatorCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "ACTIVE") back("/creator/campaigns", undefined, "Chiến dịch không còn mở");
  await prisma.creatorCampaignJoin.upsert({
    where: { campaignId_creatorId: { campaignId, creatorId: creator.id } },
    create: { campaignId, creatorId: creator.id, status: "PENDING" },
    update: { status: "PENDING" },
  });
  back("/creator/campaigns", "Đã đăng ký tham gia, chờ duyệt");
}

export async function updateProfileAction(formData: FormData) {
  const { creator } = await requireCreator();
  await prisma.creator.update({
    where: { id: creator.id },
    data: {
      displayName: String(formData.get("displayName") ?? creator.displayName).trim().slice(0, 120) || creator.displayName,
      country: String(formData.get("country") ?? "").trim().slice(0, 60),
      language: String(formData.get("language") ?? "").trim().slice(0, 30),
      contactMethod: String(formData.get("contactMethod") ?? "").trim().slice(0, 40),
      contactInfo: String(formData.get("contactInfo") ?? "").trim().slice(0, 160),
    },
  });
  back("/creator/settings", "Đã lưu hồ sơ");
}

export async function addChannelAction(formData: FormData) {
  const { creator } = await requireCreator();
  const platform = String(formData.get("platform") ?? "");
  if (!PLATFORMS.includes(platform)) back("/creator/settings", undefined, "Nền tảng không hợp lệ");
  await prisma.creatorChannel.create({
    data: {
      creatorId: creator.id,
      platform,
      channelName: String(formData.get("channelName") ?? "").trim().slice(0, 120),
      url: String(formData.get("url") ?? "").trim().slice(0, 300),
      followers: Math.max(0, parseInt(String(formData.get("followers") ?? "0"), 10) || 0),
      avgViews: Math.max(0, parseInt(String(formData.get("avgViews") ?? "0"), 10) || 0),
      category: String(formData.get("category") ?? "").trim().slice(0, 80),
      audienceCountry: String(formData.get("audienceCountry") ?? "").trim().slice(0, 60),
    },
  });
  back("/creator/settings", "Đã thêm kênh");
}

export async function deleteChannelAction(formData: FormData) {
  const { creator } = await requireCreator();
  const id = Number(formData.get("id"));
  await prisma.creatorChannel.deleteMany({ where: { id, creatorId: creator.id } });
  back("/creator/settings");
}

export async function siteBaseUrl() {
  const s = await getSettings();
  return (s.site_url || "https://bntgame.com").replace(/\/$/, "");
}

export async function updatePublicProfileAction(formData: FormData) {
  const { creator } = await requireCreator();
  await prisma.creator.update({
    where: { id: creator.id },
    data: {
      displayName: String(formData.get("displayName") ?? creator.displayName).trim().slice(0, 120) || creator.displayName,
      headline: String(formData.get("headline") ?? "").trim().slice(0, 140),
      bio: String(formData.get("bio") ?? "").trim().slice(0, 1200),
    },
  });
  back("/creator/settings", "Đã lưu trang cá nhân");
}

export async function uploadCreatorImageAction(formData: FormData) {
  const { creator } = await requireCreator();
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "avatar" && kind !== "cover") back("/creator/settings", undefined, "Loại ảnh không hợp lệ");
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) back("/creator/settings", undefined, "Chưa chọn file ảnh");
  const max = kind === "avatar" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > max) back("/creator/settings", undefined, kind === "avatar" ? "Ảnh đại diện tối đa 2MB" : "Ảnh bìa tối đa 5MB");
  const okTypes: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
  const ext = okTypes[file.type];
  if (!ext) back("/creator/settings", undefined, "Chỉ nhận file PNG, JPG, WEBP hoặc GIF");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const pathMod = await import("node:path");
  const dir = pathMod.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const name = `creator-${creator.id}-${kind}-${Date.now()}.${ext}`;
  await writeFile(pathMod.join(dir, name), Buffer.from(await file.arrayBuffer()));
  await prisma.creator.update({
    where: { id: creator.id },
    data: kind === "avatar" ? { avatarUrl: `/uploads/${name}` } : { coverUrl: `/uploads/${name}` },
  });
  back("/creator/settings", kind === "avatar" ? "Đã cập nhật ảnh đại diện" : "Đã cập nhật ảnh bìa");
}

export async function removeCreatorImageAction(formData: FormData) {
  const { creator } = await requireCreator();
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "avatar" && kind !== "cover") back("/creator/settings", undefined, "Loại ảnh không hợp lệ");
  await prisma.creator.update({
    where: { id: creator.id },
    data: kind === "avatar" ? { avatarUrl: "" } : { coverUrl: "" },
  });
  back("/creator/settings", "Đã gỡ ảnh");
}
