import { prisma } from "./db";
import { getSettings } from "./settings";


export const PARTNER_TYPES_SEED: Array<{ code: string; name: string; tagline: string; description: string; sort: number }> = [
  { code: "CREATOR", name: "Creator / Influencer", tagline: "Video, review, nội dung giới thiệu BNTGame", description: "Dành cho YouTuber, TikToker, KOL và nhà sáng tạo nội dung muốn sản xuất video, bài review hoặc nội dung giới thiệu BNTGame theo brief và thỏa thuận riêng.", sort: 1 },
  { code: "STREAMER", name: "Streamer Partnership", tagline: "Livestream, logo trên stream, nhắc thương hiệu", description: "Hợp tác livestream: đặt logo, nhắc thương hiệu, buổi stream chuyên đề về game và ưu đãi trên BNTGame, tính phí theo buổi hoặc theo tháng.", sort: 2 },
  { code: "COMMUNITY", name: "Community Partnership", tagline: "Discord, Facebook Group, cộng đồng game", description: "Dành cho chủ cộng đồng Discord, Facebook Group, diễn đàn game: đặt banner, bài đăng giới thiệu, tài trợ hoạt động và quà tặng cho thành viên.", sort: 3 },
  { code: "SPONSORSHIP", name: "Sponsorship", tagline: "Tài trợ giải đấu, sự kiện, giveaway", description: "BNTGame tài trợ giải đấu, sự kiện, giveaway hoặc đội tuyển bằng tiền mặt, sản phẩm, số dư hoặc giải thưởng — ghi nhận từng hạng mục và quyền lợi nhà tài trợ.", sort: 4 },
  { code: "MEDIA", name: "Media / Content Partnership", tagline: "Bài PR, đánh giá, đồng sản xuất nội dung", description: "Hợp tác truyền thông: bài PR, bài đánh giá, nội dung hướng dẫn hoặc đồng sản xuất nội dung cùng BNTGame, tính phí theo bài hoặc theo gói.", sort: 5 },
  { code: "AMBASSADOR", name: "Brand Ambassador", tagline: "Đại sứ thương hiệu theo thời hạn", description: "Đại sứ thương hiệu có thời hạn với lịch đăng nội dung và quyền lợi cam kết, phí định kỳ kèm bonus theo KPI nếu hai bên thống nhất.", sort: 6 },
  { code: "BUSINESS", name: "Business Partnership", tagline: "Doanh nghiệp, agency, nhà cung cấp", description: "Hợp tác doanh nghiệp: nhà phát hành, nhà cung cấp game, agency, đơn vị thanh toán — theo hợp đồng, chiết khấu, phí dịch vụ hoặc chia sẻ doanh thu.", sort: 7 },
  { code: "AFFILIATE", name: "Affiliate Partnership", tagline: "Link/mã giới thiệu, hoa hồng theo đơn hàng", description: "Chương trình giới thiệu khách hàng: nhận link và mã riêng, hoa hồng ghi nhận theo đơn hàng đủ điều kiện. Đây là một loại hình trong Partnership, được bật riêng theo thỏa thuận.", sort: 8 },
  { code: "CUSTOM", name: "Custom Partnership", tagline: "Đề xuất đặc thù theo nhu cầu của bạn", description: "Ý tưởng hợp tác chưa thuộc nhóm nào ở trên? Gửi đề xuất của bạn, đội Partnership sẽ xem xét và phản hồi phương án phù hợp.", sort: 9 },
];

export const TYPE_SLUGS: Record<string, string> = {
  CREATOR: "creator",
  STREAMER: "streamer",
  COMMUNITY: "community",
  SPONSORSHIP: "sponsorship",
  MEDIA: "media",
  AMBASSADOR: "ambassador",
  BUSINESS: "business",
  AFFILIATE: "affiliate",
  CUSTOM: "custom",
};

export function typeSlug(code: string): string {
  return TYPE_SLUGS[code] ?? code.toLowerCase();
}

export function codeFromSlug(slug: string): string | null {
  const hit = Object.entries(TYPE_SLUGS).find(([, s]) => s === slug);
  return hit ? hit[0] : null;
}

export async function ensurePartnershipTypes() {
  const n = await prisma.partnershipType.count();
  if (n > 0) return;
  await prisma.partnershipType.createMany({ data: PARTNER_TYPES_SEED });
}

export async function getActivePartnershipTypes() {
  await ensurePartnershipTypes();
  return prisma.partnershipType.findMany({ where: { isActive: true }, orderBy: { sort: "asc" } });
}

export const APPLICATION_STATUS: Record<string, string> = {
  SUBMITTED: "Đã gửi — chờ xem xét",
  UNDER_REVIEW: "Đang đánh giá",
  NEEDS_INFO: "Cần bổ sung thông tin",
  APPROVED: "Đã chấp thuận",
  REJECTED: "Đã từ chối",
};

export const PARTNER_STATUS: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Tạm ngưng",
  SUSPENDED: "Đã khóa",
};

export const CAMPAIGN_STATUS: Record<string, string> = {
  DRAFT: "Bản nháp",
  PROPOSED: "Đã đề xuất",
  SCHEDULED: "Đã lên lịch",
  ACTIVE: "Đang chạy",
  PAUSED: "Tạm dừng",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
};

export const DELIVERABLE_STATUS: Record<string, string> = {
  PENDING: "Chờ thực hiện",
  SUBMITTED: "Đã nộp — chờ duyệt",
  IN_REVIEW: "Đang kiểm tra",
  REVISION_REQUIRED: "Cần chỉnh sửa",
  APPROVED: "Đã nghiệm thu",
  REJECTED: "Không đạt",
};

export const PAYMENT_STATUS: Record<string, string> = {
  DRAFT: "Bản nháp",
  PENDING_APPROVAL: "Chờ phê duyệt",
  APPROVED: "Đã duyệt — chờ chi",
  PROCESSING: "Đang xử lý",
  PAID: "Đã thanh toán",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
};

export const PAYMENT_TYPE: Record<string, string> = {
  FIXED_FEE: "Phí cố định",
  MILESTONE: "Theo mốc công việc",
  RETAINER: "Phí định kỳ",
  HYBRID: "Kết hợp (Hybrid)",
  PERFORMANCE_BONUS: "Thưởng theo KPI",
  PRODUCT_CREDIT: "Tài trợ sản phẩm / số dư",
};

export const PROPOSAL_STATUS: Record<string, string> = {
  DRAFT: "Bản nháp",
  SENT: "Đã gửi đối tác",
  COUNTERED: "Đối tác phản hồi giá",
  ACCEPTED: "Đã chấp nhận",
  DECLINED: "Đã từ chối",
  EXPIRED: "Hết hạn",
};

export const AGREEMENT_STATUS: Record<string, string> = {
  DRAFT: "Bản nháp",
  SENT: "Đã gửi đối tác",
  CONFIRMED: "Đã xác nhận",
  EXPIRED: "Hết hạn",
  TERMINATED: "Đã chấm dứt",
};

export const DELIVERABLE_FLOW: Record<string, string[]> = {
  PENDING: ["SUBMITTED", "IN_REVIEW"],
  SUBMITTED: ["IN_REVIEW", "REVISION_REQUIRED", "APPROVED", "REJECTED"],
  IN_REVIEW: ["REVISION_REQUIRED", "APPROVED", "REJECTED"],
  REVISION_REQUIRED: ["SUBMITTED", "IN_REVIEW"],
  APPROVED: [],
  REJECTED: ["PENDING"],
};

export const PAYMENT_FLOW: Record<string, string[]> = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "CANCELLED"],
  APPROVED: ["PROCESSING", "PAID", "CANCELLED"],
  PROCESSING: ["PAID", "FAILED"],
  FAILED: ["PROCESSING", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

export function campaignCode(id: number): string {
  return `PTC${String(id).padStart(5, "0")}`;
}

export async function partnershipPaymentMethods(): Promise<string[]> {
  const raw = (await getSettings())["partner_payment_methods"] || "USDT,BANK";
  return raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  USDT: "USDT (crypto)",
  BANK: "Chuyển khoản ngân hàng VN",
  PAYPAL: "PayPal",
};

export async function createPartnerFromApplication(applicationId: number, adminId: number) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.partnerApplication.findUnique({ where: { id: applicationId } });
    if (!app) throw new Error("APPLICATION_NOT_FOUND");
    if (app.partnerId) {
      const existing = await tx.partner.findUnique({ where: { id: app.partnerId } });
      if (existing) return existing;
    }
    if (app.applicantUserId) {
      const byUser = await tx.partner.findUnique({ where: { userId: app.applicantUserId } });
      if (byUser) {
        await tx.partnerApplication.update({ where: { id: app.id }, data: { partnerId: byUser.id, status: "APPROVED", reviewedById: adminId, reviewedAt: new Date() } });
        return byUser;
      }
    }
    const socialLinks = Array.isArray(app.socialLinksJson) ? app.socialLinksJson : [];
    const partner = await tx.partner.create({
      data: {
        userId: app.applicantUserId ?? null,
        applicantType: app.applicantType,
        displayName: app.fullName,
        email: app.email,
        country: app.country,
        status: "ACTIVE",
        profile: {
          create: {
            socialLinksJson: socialLinks as object[],
            audienceJson: { note: app.audienceText },
          },
        },
      },
    });
    await tx.partnerApplication.update({
      where: { id: app.id },
      data: { partnerId: partner.id, status: "APPROVED", reviewedById: adminId, reviewedAt: new Date() },
    });
    return partner;
  });
}
