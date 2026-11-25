"use server";

import { redirect } from "next/navigation";
import { unstable_rethrow } from "next/navigation";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { requireAdmin, requireOwner } from "@/lib/auth";
import { audit, setSetting } from "@/lib/settings";
import { notifyUser } from "@/lib/notify";
import { isMailConfigured, sendMail } from "@/lib/mailer";
import {
  createPartnerFromApplication,
  DELIVERABLE_FLOW,
  PAYMENT_FLOW,
  partnershipPaymentMethods,
} from "@/lib/partnership";

function back(path: string, msg?: string, err?: string): never {
  const q = err ? `?err=${encodeURIComponent(err)}` : msg ? `?msg=${encodeURIComponent(msg)}` : "";
  redirect(path + q);
}

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);
const money = (fd: FormData, k: string) => {
  const v = parseFloat(String(fd.get(k) ?? "0"));
  return Number.isFinite(v) ? Math.round(v * 100) : 0;
};
const dateOrNull = (fd: FormData, k: string) => {
  const raw = String(fd.get(k) ?? "");
  const d = raw ? new Date(raw) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};

async function mailApplicant(email: string, subject: string, html: string) {
  if (!(await isMailConfigured().catch(() => false))) return;
  await sendMail(email, subject, html).catch(() => false);
}

export async function reviewPartnerApplicationAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  const kind = String(formData.get("kind") ?? "");
  const dest = `/admin/partnership/applications/${id}`;
  if (!["review", "needs_info", "approve", "reject"].includes(kind)) back(dest, undefined, "Thao tác không rõ ràng — đã chặn");
  const app = await prisma.partnerApplication.findUnique({ where: { id } });
  if (!app) back("/admin/partnership/applications", undefined, "Không tìm thấy hồ sơ");
  if (app.status === "APPROVED" || app.status === "REJECTED") back(dest, undefined, "Hồ sơ đã được xử lý xong");
  const note = str(formData, "reviewNote", 500);
  const response = str(formData, "partnerResponse", 1000);
  try {
    if (kind === "review") {
      await prisma.partnerApplication.update({ where: { id }, data: { status: "UNDER_REVIEW", reviewNote: note || app.reviewNote, reviewedById: admin.id, reviewedAt: new Date() } });
      back(dest, "Đã chuyển hồ sơ sang Đang đánh giá");
    }
    if (kind === "needs_info") {
      if (!response) back(dest, undefined, "Cần ghi rõ thông tin phải bổ sung để gửi cho người nộp");
      await prisma.partnerApplication.update({ where: { id }, data: { status: "NEEDS_INFO", reviewNote: note || app.reviewNote, partnerResponse: response, reviewedById: admin.id, reviewedAt: new Date() } });
      if (app.applicantUserId) await notifyUser(app.applicantUserId, "PARTNERSHIP", "Hồ sơ hợp tác cần bổ sung thông tin", response, "/partnership/apply");
      await mailApplicant(app.email, "Hồ sơ hợp tác BNTGame cần bổ sung thông tin", `<p>Xin chào ${app.fullName},</p><p>Đội Partnership BNTGame cần bạn bổ sung thông tin cho hồ sơ #${app.id}:</p><p><b>${response}</b></p><p>Vui lòng trả lời email này kèm thông tin bổ sung.</p>`);
      await audit(admin.id, "partnership.application.needs_info", `#${id} ${app.email}`);
      back(dest, "Đã yêu cầu bổ sung thông tin");
    }
    if (kind === "reject") {
      await prisma.partnerApplication.update({ where: { id }, data: { status: "REJECTED", reviewNote: note, partnerResponse: response, reviewedById: admin.id, reviewedAt: new Date() } });
      if (app.applicantUserId) await notifyUser(app.applicantUserId, "PARTNERSHIP", "Kết quả hồ sơ hợp tác", response || "Hồ sơ của bạn chưa phù hợp đợt này.", "/partnership");
      await mailApplicant(app.email, "Kết quả hồ sơ hợp tác BNTGame", `<p>Xin chào ${app.fullName},</p><p>Cảm ơn bạn đã gửi hồ sơ hợp tác. Sau khi xem xét, BNTGame chưa thể hợp tác theo đề xuất này ở thời điểm hiện tại.</p>${response ? `<p>${response}</p>` : ""}`);
      await audit(admin.id, "partnership.application.reject", `#${id} ${app.email}: ${note}`);
      back("/admin/partnership/applications", "Đã từ chối hồ sơ");
    }
    const partner = await createPartnerFromApplication(id, admin.id);
    if (response || note) {
      await prisma.partnerApplication.update({ where: { id }, data: { reviewNote: note || app.reviewNote, partnerResponse: response || app.partnerResponse } });
    }
    if (app.applicantUserId) await notifyUser(app.applicantUserId, "PARTNERSHIP", "Hồ sơ hợp tác đã được chấp thuận", "BNTGame đã tạo hồ sơ đối tác cho bạn. Đội Partnership sẽ liên hệ để trao đổi thỏa thuận cụ thể.", "/partnership");
    await mailApplicant(app.email, "Hồ sơ hợp tác BNTGame đã được chấp thuận", `<p>Xin chào ${app.fullName},</p><p>Hồ sơ hợp tác của bạn đã được BNTGame chấp thuận. Đội Partnership sẽ liên hệ để trao đổi phạm vi công việc và thỏa thuận cụ thể cho từng chiến dịch.</p>`);
    await audit(admin.id, "partnership.application.approve", `#${id} ${app.email} -> partner ${partner.id}`);
  } catch (e) {
    unstable_rethrow(e);
    back(dest, undefined, "Xử lý thất bại: " + (e instanceof Error ? e.message : "lỗi"));
  }
  back("/admin/partnership/applications", "Đã duyệt hồ sơ — đã tạo hồ sơ Partner");
}

export async function addApplicationMessageAction(formData: FormData) {
  const admin = await requireAdmin();
  const applicationId = Number(formData.get("applicationId"));
  const message = str(formData, "message", 2000);
  const visibility = String(formData.get("visibility") ?? "INTERNAL") === "PARTNER" ? "PARTNER" : "INTERNAL";
  if (!message) back(`/admin/partnership/applications/${applicationId}`, undefined, "Nội dung trống");
  const app = await prisma.partnerApplication.findUnique({ where: { id: applicationId }, select: { partnerId: true } });
  await prisma.partnerMessage.create({ data: { applicationId, partnerId: app?.partnerId ?? null, senderId: admin.id, visibility, message } });
  await audit(admin.id, "partnership.message.add", `application ${applicationId} (${visibility})`);
  back(`/admin/partnership/applications/${applicationId}`, "Đã lưu trao đổi");
}

export async function savePartnerAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) back("/admin/partnership/partners", undefined, "Không tìm thấy Partner");
  const status = String(formData.get("status") ?? partner.status);
  await prisma.partner.update({
    where: { id },
    data: {
      displayName: str(formData, "displayName", 160) || partner.displayName,
      legalName: str(formData, "legalName", 200),
      country: str(formData, "country", 80),
      status: ["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status) ? status : partner.status,
      internalNote: str(formData, "internalNote", 2000),
    },
  });
  await prisma.partnerProfile.upsert({
    where: { partnerId: id },
    create: { partnerId: id, bio: str(formData, "bio", 2000), website: str(formData, "website", 300), mediaKitUrl: str(formData, "mediaKitUrl", 400) },
    update: { bio: str(formData, "bio", 2000), website: str(formData, "website", 300), mediaKitUrl: str(formData, "mediaKitUrl", 400) },
  });
  await audit(admin.id, "partnership.partner.update", `${id}: ${partner.displayName}`);
  back(`/admin/partnership/partners/${id}`, "Đã lưu hồ sơ Partner");
}

export async function enableAffiliateAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  const dest = `/admin/partnership/partners/${id}`;
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) back("/admin/partnership/partners", undefined, "Không tìm thấy Partner");
  if (partner.creatorId) back(dest, undefined, "Partner này đã bật Affiliate rồi");
  if (!partner.userId) back(dest, undefined, "Partner chưa có tài khoản BNTGame — cần gắn tài khoản trước khi bật Affiliate");
  const user = await prisma.user.findUnique({ where: { id: partner.userId } });
  if (!user) back(dest, undefined, "Tài khoản gắn với Partner không còn tồn tại");
  try {
    const { ensureCreatorLevels, creatorCodeFromId } = await import("@/lib/creator");
    let creator = await prisma.creator.findUnique({ where: { userId: user.id } });
    if (!creator) {
      await ensureCreatorLevels();
      const starter = await prisma.creatorLevel.findFirst({ orderBy: { sort: "asc" } });
      const code = creatorCodeFromId(user.id, partner.displayName);
      creator = await prisma.$transaction(async (tx) => {
        const c = await tx.creator.create({
          data: { userId: user.id, code, displayName: partner.displayName, country: partner.country, levelId: starter?.id, agreementAt: new Date() },
        });
        await tx.creatorLink.create({ data: { creatorId: c.id, code: c.code, name: "Link mặc định", destination: "/" } });
        return c;
      });
    }
    await prisma.partner.update({ where: { id }, data: { creatorId: creator.id } });
    await notifyUser(user.id, "PARTNERSHIP", "Affiliate đã được bật cho tài khoản của bạn", `Link giới thiệu của bạn: /ref/${creator.code}. Xem thêm trong Creator Dashboard.`, "/creator/dashboard");
    await audit(admin.id, "partnership.affiliate.enable", `partner ${id} -> creator ${creator.code}`);
  } catch (e) {
    unstable_rethrow(e);
    back(dest, undefined, "Bật Affiliate thất bại: " + (e instanceof Error ? e.message : "lỗi"));
  }
  back(dest, "Đã bật Affiliate cho Partner");
}

export async function saveProposalAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  const partnerId = Number(formData.get("partnerId"));
  const title = str(formData, "title", 200);
  if (!partnerId || !title) back("/admin/partnership/proposals", undefined, "Thiếu Partner hoặc tiêu đề đề xuất");
  const data = {
    partnerId,
    applicationId: Number(formData.get("applicationId") ?? 0) || null,
    title,
    scopeText: str(formData, "scopeText", 3000),
    priceCents: money(formData, "price"),
    currency: (str(formData, "currency", 8) || "USD").toUpperCase(),
    expiresAt: dateOrNull(formData, "expiresAt"),
  };
  if (id) {
    await prisma.proposal.update({ where: { id }, data });
    await audit(admin.id, "partnership.proposal.update", `${id}: ${title}`);
    back("/admin/partnership/proposals", "Đã lưu đề xuất");
  }
  const p = await prisma.proposal.create({ data: { ...data, createdById: admin.id } });
  await audit(admin.id, "partnership.proposal.create", `${p.id}: ${title} -> partner ${partnerId}`);
  back("/admin/partnership/proposals", "Đã tạo đề xuất");
}

export async function setProposalStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  const kind = String(formData.get("kind") ?? "");
  const map: Record<string, string> = { send: "SENT", counter: "COUNTERED", accept: "ACCEPTED", decline: "DECLINED", expire: "EXPIRED" };
  if (!map[kind]) back("/admin/partnership/proposals", undefined, "Thao tác không rõ ràng — đã chặn");
  await prisma.proposal.update({ where: { id }, data: { status: map[kind] } });
  await audit(admin.id, "partnership.proposal." + kind, String(id));
  back("/admin/partnership/proposals", "Đã cập nhật đề xuất");
}

export async function savePartnershipTypeAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  await prisma.partnershipType.update({
    where: { id },
    data: {
      name: str(formData, "name", 120),
      tagline: str(formData, "tagline", 200),
      description: str(formData, "description", 2000),
      isActive: String(formData.get("isActive") ?? "") === "1",
      sort: parseInt(String(formData.get("sort") ?? "0"), 10) || 0,
    },
  });
  await audit(admin.id, "partnership.type.update", String(id));
  back("/admin/partnership/types", "Đã lưu loại hình");
}

export async function savePartnerCampaignAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  const name = str(formData, "name", 200);
  if (!name) back("/admin/partnership/campaigns", undefined, "Thiếu tên chiến dịch");
  const status = String(formData.get("status") ?? "DRAFT");
  const data = {
    name,
    typeCode: str(formData, "typeCode", 20) || "CUSTOM",
    objective: str(formData, "objective", 1000),
    brief: str(formData, "brief", 5000),
    startAt: dateOrNull(formData, "startAt"),
    endAt: dateOrNull(formData, "endAt"),
    budgetCents: money(formData, "budget"),
    currency: (str(formData, "currency", 8) || "USD").toUpperCase(),
    status: ["DRAFT", "PROPOSED", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"].includes(status) ? status : "DRAFT",
  };
  if (id) {
    await prisma.partnerCampaign.update({ where: { id }, data });
    await audit(admin.id, "partnership.campaign.update", `${id}: ${name}`);
    back(`/admin/partnership/campaigns/${id}`, "Đã lưu chiến dịch");
  }
  const created = await prisma.partnerCampaign.create({ data: { ...data, code: "TMP", ownerId: admin.id } });
  const { campaignCode } = await import("@/lib/partnership");
  await prisma.partnerCampaign.update({ where: { id: created.id }, data: { code: campaignCode(created.id) } });
  await audit(admin.id, "partnership.campaign.create", `${created.id}: ${name}`);
  back(`/admin/partnership/campaigns/${created.id}`, "Đã tạo chiến dịch");
}

export async function invitePartnerAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignId = Number(formData.get("campaignId"));
  const partnerId = Number(formData.get("partnerId"));
  const dest = `/admin/partnership/campaigns/${campaignId}`;
  if (!partnerId) back(dest, undefined, "Chưa chọn Partner");
  const exists = await prisma.campaignPartner.findUnique({ where: { campaignId_partnerId: { campaignId, partnerId } } });
  if (exists) back(dest, undefined, "Partner đã có trong chiến dịch này");
  await prisma.campaignPartner.create({ data: { campaignId, partnerId, status: "INVITED" } });
  const partner = await prisma.partner.findUnique({ where: { id: partnerId }, select: { userId: true, displayName: true } });
  if (partner?.userId) {
    const c = await prisma.partnerCampaign.findUnique({ where: { id: campaignId }, select: { name: true } });
    await notifyUser(partner.userId, "PARTNERSHIP", "Lời mời tham gia chiến dịch", `BNTGame mời bạn tham gia chiến dịch: ${c?.name ?? ""}.`, "/partnership");
  }
  await audit(admin.id, "partnership.campaign.invite", `campaign ${campaignId} <- partner ${partnerId}`);
  back(dest, "Đã mời Partner vào chiến dịch");
}

export async function setJoinStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  const campaignId = Number(formData.get("campaignId"));
  const kind = String(formData.get("kind") ?? "");
  const map: Record<string, string> = { accept: "ACCEPTED", decline: "DECLINED", remove: "REMOVED", invite: "INVITED" };
  if (!map[kind]) back(`/admin/partnership/campaigns/${campaignId}`, undefined, "Thao tác không rõ ràng — đã chặn");
  await prisma.campaignPartner.update({ where: { id }, data: { status: map[kind] } });
  await audit(admin.id, "partnership.campaign.join." + kind, String(id));
  back(`/admin/partnership/campaigns/${campaignId}`, "Đã cập nhật trạng thái tham gia");
}

export async function saveDeliverableAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignPartnerId = Number(formData.get("campaignPartnerId"));
  const campaignId = Number(formData.get("campaignId"));
  const title = str(formData, "title", 200);
  if (!campaignPartnerId || !title) back(`/admin/partnership/campaigns/${campaignId}`, undefined, "Thiếu đầu việc hoặc Partner");
  await prisma.deliverable.create({
    data: {
      campaignPartnerId,
      title,
      description: str(formData, "description", 2000),
      dueAt: dateOrNull(formData, "dueAt"),
    },
  });
  await audit(admin.id, "partnership.deliverable.create", `${title} (join ${campaignPartnerId})`);
  back(`/admin/partnership/campaigns/${campaignId}`, "Đã thêm đầu việc");
}

export async function reviewDeliverableAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  const kind = String(formData.get("kind") ?? "");
  const backTo = String(formData.get("backTo") ?? "/admin/partnership/deliverables");
  const map: Record<string, string> = { review: "IN_REVIEW", revision: "REVISION_REQUIRED", approve: "APPROVED", reject: "REJECTED", reopen: "PENDING", submit: "SUBMITTED" };
  if (!map[kind]) back(backTo, undefined, "Thao tác không rõ ràng — đã chặn");
  const d = await prisma.deliverable.findUnique({ where: { id }, include: { campaignPartner: { include: { partner: { select: { userId: true, displayName: true } }, campaign: { select: { name: true } } } } } });
  if (!d) back(backTo, undefined, "Không tìm thấy đầu việc");
  const next = map[kind];
  if (!DELIVERABLE_FLOW[d.status]?.includes(next)) back(backTo, undefined, `Không thể chuyển từ trạng thái hiện tại sang ${next}`);
  const note = str(formData, "reviewNote", 1000);
  if ((kind === "revision" || kind === "reject") && !note) back(backTo, undefined, "Cần ghi rõ lý do / yêu cầu chỉnh sửa");
  await prisma.deliverable.update({
    where: { id },
    data: {
      status: next,
      reviewNote: note || d.reviewNote,
      reviewerId: admin.id,
      reviewedAt: new Date(),
      submittedAt: kind === "submit" ? new Date() : d.submittedAt,
      submittedUrl: kind === "submit" ? (str(formData, "submittedUrl", 600) || d.submittedUrl) : d.submittedUrl,
    },
  });
  const partnerUserId = d.campaignPartner.partner.userId;
  if (partnerUserId && ["REVISION_REQUIRED", "APPROVED", "REJECTED"].includes(next)) {
    await notifyUser(partnerUserId, "PARTNERSHIP", `Đầu việc "${d.title}": ${next === "APPROVED" ? "đã nghiệm thu" : next === "REJECTED" ? "không đạt" : "cần chỉnh sửa"}`, note || `Chiến dịch ${d.campaignPartner.campaign.name}.`, "/partnership");
  }
  await audit(admin.id, "partnership.deliverable." + kind, `${id}: ${d.title}`);
  back(backTo, "Đã cập nhật đầu việc");
}

export async function saveAgreementAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  const partnerId = Number(formData.get("partnerId"));
  const title = str(formData, "title", 200);
  if (!partnerId || !title) back("/admin/partnership/agreements", undefined, "Thiếu Partner hoặc tiêu đề thỏa thuận");
  let contractFileUrl = str(formData, "contractFileUrl", 500);
  let contractFileName = str(formData, "contractFileName", 200);
  const file = formData.get("contractFile");
  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) back("/admin/partnership/agreements", undefined, "File hợp đồng tối đa 10MB");
    const ext = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!["pdf", "doc", "docx", "png", "jpg", "jpeg"].includes(ext)) back("/admin/partnership/agreements", undefined, "Chỉ nhận file PDF, Word hoặc ảnh");
    const dir = path.join(process.cwd(), "public", "uploads", "contracts");
    await mkdir(dir, { recursive: true });
    const fname = `contract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await writeFile(path.join(dir, fname), Buffer.from(await file.arrayBuffer()));
    contractFileUrl = `/uploads/contracts/${fname}`;
    contractFileName = file.name.slice(0, 200);
  }
  const status = String(formData.get("status") ?? "DRAFT");
  const data = {
    partnerId,
    campaignId: Number(formData.get("campaignId") ?? 0) || null,
    title,
    scopeText: str(formData, "scopeText", 4000),
    feeCents: money(formData, "fee"),
    currency: (str(formData, "currency", 8) || "USD").toUpperCase(),
    contentRightsText: str(formData, "contentRightsText", 2000),
    contractFileUrl,
    contractFileName,
    status: ["DRAFT", "SENT", "CONFIRMED", "EXPIRED", "TERMINATED"].includes(status) ? status : "DRAFT",
    sentAt: status === "SENT" ? new Date() : undefined,
    confirmedAt: status === "CONFIRMED" ? new Date() : undefined,
    effectiveAt: dateOrNull(formData, "effectiveAt"),
    expiresAt: dateOrNull(formData, "expiresAt"),
  };
  if (id) {
    const old = await prisma.agreement.findUnique({ where: { id }, select: { version: true, contractFileUrl: true } });
    const version = old && contractFileUrl && old.contractFileUrl && contractFileUrl !== old.contractFileUrl ? old.version + 1 : old?.version ?? 1;
    await prisma.agreement.update({ where: { id }, data: { ...data, version } });
    await audit(admin.id, "partnership.agreement.update", `${id}: ${title} v${version}`);
    back("/admin/partnership/agreements", "Đã lưu thỏa thuận");
  }
  const a = await prisma.agreement.create({ data });
  await audit(admin.id, "partnership.agreement.create", `${a.id}: ${title} -> partner ${partnerId}`);
  back("/admin/partnership/agreements", "Đã tạo thỏa thuận");
}

export async function savePartnerPaymentAction(formData: FormData) {
  const admin = await requireOwner();
  const partnerId = Number(formData.get("partnerId"));
  const amountCents = money(formData, "amount");
  if (!partnerId || amountCents <= 0) back("/admin/partnership/payments", undefined, "Thiếu Partner hoặc số tiền không hợp lệ");
  const methods = await partnershipPaymentMethods();
  const method = str(formData, "method", 20).toUpperCase();
  if (method && !methods.includes(method)) back("/admin/partnership/payments", undefined, "Phương thức chi trả chưa được bật");
  const type = String(formData.get("type") ?? "FIXED_FEE");
  const p = await prisma.partnerPayment.create({
    data: {
      partnerId,
      campaignId: Number(formData.get("campaignId") ?? 0) || null,
      agreementId: Number(formData.get("agreementId") ?? 0) || null,
      deliverableId: Number(formData.get("deliverableId") ?? 0) || null,
      amountCents,
      currency: (str(formData, "currency", 8) || "USD").toUpperCase(),
      type: ["FIXED_FEE", "MILESTONE", "RETAINER", "HYBRID", "PERFORMANCE_BONUS", "PRODUCT_CREDIT"].includes(type) ? type : "FIXED_FEE",
      method,
      dueAt: dateOrNull(formData, "dueAt"),
      note: str(formData, "note", 1000),
      status: "DRAFT",
      createdById: admin.id,
    },
  });
  await audit(admin.id, "partnership.payment.create", `${p.id}: ${amountCents} -> partner ${partnerId}`);
  back("/admin/partnership/payments", "Đã tạo khoản chi (bản nháp)");
}

export async function partnerPaymentFlowAction(formData: FormData) {
  const admin = await requireOwner();
  const id = Number(formData.get("id"));
  const kind = String(formData.get("kind") ?? "");
  const map: Record<string, string> = { submit: "PENDING_APPROVAL", approve: "APPROVED", process: "PROCESSING", paid: "PAID", fail: "FAILED", cancel: "CANCELLED" };
  if (!map[kind]) back("/admin/partnership/payments", undefined, "Thao tác tiền không rõ ràng — đã chặn");
  const p = await prisma.partnerPayment.findUnique({ where: { id }, include: { partner: { select: { userId: true, displayName: true } } } });
  if (!p) back("/admin/partnership/payments", undefined, "Không tìm thấy khoản chi");
  const next = map[kind];
  if (!PAYMENT_FLOW[p.status]?.includes(next)) back("/admin/partnership/payments", undefined, `Không thể chuyển khoản chi từ ${p.status} sang ${next}`);
  if (kind === "approve" && p.createdById && p.createdById !== admin.id) { /* người khác duyệt: đúng luật */ }
  else if (kind === "approve" && p.createdById === admin.id) {
    const otherAdmins = await prisma.user.count({ where: { role: "ADMIN", active: true, id: { not: admin.id } } });
    if (otherAdmins > 0) back("/admin/partnership/payments", undefined, "Người tạo khoản chi không được tự phê duyệt — cần admin khác duyệt");
  }
  const txRef = str(formData, "txRef", 200);
  if (kind === "paid" && !txRef) back("/admin/partnership/payments", undefined, "Cần mã giao dịch / chứng từ khi đánh dấu đã trả");
  await prisma.partnerPayment.update({
    where: { id },
    data: {
      status: next,
      approvedById: kind === "approve" ? admin.id : p.approvedById,
      paidAt: kind === "paid" ? new Date() : p.paidAt,
      txRef: txRef || p.txRef,
      receiptUrl: str(formData, "receiptUrl", 500) || p.receiptUrl,
    },
  });
  if (p.partner.userId && ["APPROVED", "PAID", "FAILED"].includes(next)) {
    await notifyUser(p.partner.userId, "PARTNERSHIP", `Khoản thanh toán Partnership: ${next === "PAID" ? "đã thanh toán" : next === "APPROVED" ? "đã được duyệt" : "thất bại"}`, `${p.amountCents / 100} ${p.currency} — ${p.note || p.type}.`, "/partnership");
  }
  await audit(admin.id, "partnership.payment." + kind, `${id}: ${p.amountCents} ${p.currency}`);
  back("/admin/partnership/payments", "Đã cập nhật khoản chi");
}

export async function savePartnerSettingsAction(formData: FormData) {
  const admin = await requireOwner();
  const methods = ["USDT", "BANK", "PAYPAL"].filter((m) => String(formData.get(`m_${m}`) ?? "") === "1");
  if (methods.length === 0) back("/admin/partnership/settings", undefined, "Cần bật ít nhất một phương thức chi trả");
  await setSetting("partner_payment_methods", methods.join(","));
  await audit(admin.id, "partnership.settings", `methods=${methods.join(",")}`);
  back("/admin/partnership/settings", "Đã lưu cài đặt Partnership");
}
