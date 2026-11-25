"use server";
import { redirect, unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getPartnerForUser } from "@/lib/partner-portal";

function back(path: string, msg?: string, err?: string): never {
  const q = err ? `err=${encodeURIComponent(err)}` : msg ? `msg=${encodeURIComponent(msg)}` : "";
  redirect(q ? `${path}?${q}` : path);
}

async function requirePartner() {
  const user = await requireUser();
  const partner = await getPartnerForUser(user.id);
  if (!partner) redirect("/partner");
  if (partner.status === "SUSPENDED") redirect("/partner");
  return partner;
}

function validUrl(s: string): boolean {
  return s === "" || /^https?:\/\/\S+$/i.test(s);
}

export async function updateProfileAction(formData: FormData) {
  const partner = await requirePartner();
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 2000);
  const website = String(formData.get("website") ?? "").trim().slice(0, 300);
  const mediaKitUrl = String(formData.get("mediaKitUrl") ?? "").trim().slice(0, 300);
  const socialRaw = String(formData.get("socialLinks") ?? "").trim().slice(0, 2000);
  const paymentNote = String(formData.get("paymentNote") ?? "").trim().slice(0, 500);
  if (!validUrl(website)) back("/partner/profile", undefined, "Website phải là link http/https hợp lệ");
  if (!validUrl(mediaKitUrl)) back("/partner/profile", undefined, "Link media kit phải là link http/https hợp lệ");
  const socialLinks = socialRaw ? socialRaw.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10) : [];
  for (const s of socialLinks) if (!validUrl(s)) back("/partner/profile", undefined, "Mỗi link mạng xã hội phải là link http/https hợp lệ");
  try {
    await prisma.partnerProfile.upsert({
      where: { partnerId: partner.id },
      create: { partnerId: partner.id, bio, website, mediaKitUrl, socialLinksJson: socialLinks, paymentInfoJson: { note: paymentNote } },
      update: { bio, website, mediaKitUrl, socialLinksJson: socialLinks, paymentInfoJson: { note: paymentNote } },
    });
  } catch (e) {
    unstable_rethrow(e);
    back("/partner/profile", undefined, "Lưu hồ sơ thất bại, thử lại sau");
  }
  back("/partner/profile", "Đã lưu hồ sơ");
}

export async function respondJoinAction(formData: FormData) {
  const partner = await requirePartner();
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "accept" && kind !== "decline") back("/partner/campaigns", undefined, "Thao tác không rõ ràng — đã chặn");
  const joinId = Number(formData.get("joinId"));
  const join = await prisma.campaignPartner.findUnique({ where: { id: joinId } });
  if (!join || join.partnerId !== partner.id) back("/partner/campaigns", undefined, "Không tìm thấy lời mời");
  if (join.status !== "INVITED") back("/partner/campaigns", undefined, "Lời mời này đã được phản hồi");
  await prisma.campaignPartner.update({ where: { id: joinId }, data: { status: kind === "accept" ? "ACCEPTED" : "DECLINED" } });
  back("/partner/campaigns", kind === "accept" ? "Đã nhận tham gia chiến dịch" : "Đã từ chối lời mời");
}

export async function submitDeliverableAction(formData: FormData) {
  const partner = await requirePartner();
  const id = Number(formData.get("id"));
  const url = String(formData.get("url") ?? "").trim().slice(0, 1000);
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  const dest = "/partner/deliverables";
  if (!url || !validUrl(url)) back(dest, undefined, "Cần nộp link http/https hợp lệ");
  const d = await prisma.deliverable.findUnique({ where: { id }, include: { campaignPartner: { select: { partnerId: true } } } });
  if (!d || d.campaignPartner.partnerId !== partner.id) back(dest, undefined, "Không tìm thấy đầu việc");
  if (d.status !== "PENDING" && d.status !== "REVISION_REQUIRED") back(dest, undefined, "Đầu việc này không ở trạng thái được nộp");
  await prisma.deliverable.update({
    where: { id },
    data: { status: "SUBMITTED", submittedUrl: url, submittedNote: note, submittedAt: new Date() },
  });
  back(dest, "Đã nộp đầu việc — chờ kiểm duyệt");
}
