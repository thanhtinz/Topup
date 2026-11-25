import Link from "next/link";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../ui";
import { APPLICATION_STATUS, DELIVERABLE_STATUS } from "@/lib/partnership";
import { fmtUSD } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminPartnershipOverview({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const now = new Date();
  const [submitted, underReview, needsInfo, totalPartners, activePartners, activeCampaigns, pendingApproval, overdueDeliverables, paidAgg] = await Promise.all([
    prisma.partnerApplication.count({ where: { status: "SUBMITTED" } }),
    prisma.partnerApplication.count({ where: { status: "UNDER_REVIEW" } }),
    prisma.partnerApplication.count({ where: { status: "NEEDS_INFO" } }),
    prisma.partner.count(),
    prisma.partner.count({ where: { status: "ACTIVE" } }),
    prisma.partnerCampaign.count({ where: { status: "ACTIVE" } }),
    prisma.partnerPayment.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.deliverable.count({ where: { status: { in: ["PENDING", "SUBMITTED", "IN_REVIEW", "REVISION_REQUIRED"] }, dueAt: { lt: now } } }),
    prisma.partnerPayment.aggregate({ where: { status: "PAID" }, _sum: { amountCents: true } }),
  ]);
  const [recentApps, upcoming] = await Promise.all([
    prisma.partnerApplication.findMany({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO"] } }, orderBy: { createdAt: "asc" }, take: 6 }),
    prisma.deliverable.findMany({
      where: { status: { in: ["PENDING", "SUBMITTED", "IN_REVIEW", "REVISION_REQUIRED"] }, dueAt: { not: null } },
      orderBy: { dueAt: "asc" }, take: 6,
      include: { campaignPartner: { include: { partner: { select: { displayName: true } }, campaign: { select: { name: true } } } } },
    }),
  ]);

  return (
    <div>
      <Top title="Partnership — Tổng quan" />
      <Msg msg={msg} err={err} />
      <div className="stat-grid">
        <div className="stat-card"><span>Hồ sơ mới chờ xem</span><strong>{submitted}</strong></div>
        <div className="stat-card"><span>Đang đánh giá</span><strong>{underReview}</strong></div>
        <div className="stat-card"><span>Cần bổ sung thông tin</span><strong>{needsInfo}</strong></div>
        <div className="stat-card"><span>Tổng Partner</span><strong>{totalPartners}</strong></div>
        <div className="stat-card"><span>Partner đang hoạt động</span><strong>{activePartners}</strong></div>
        <div className="stat-card"><span>Chiến dịch đang chạy</span><strong>{activeCampaigns}</strong></div>
        <div className="stat-card"><span>Khoản chi chờ duyệt</span><strong>{pendingApproval}</strong></div>
        <div className="stat-card"><span>Đầu việc quá hạn</span><strong>{overdueDeliverables}</strong></div>
        <div className="stat-card"><span>Đã chi Partnership (USD)</span><strong>{fmtUSD(paidAgg._sum.amountCents ?? 0)}</strong></div>
      </div>

      <div className="admin-cols">
        <div className="admin-card">
          <div className="card-head">
            <h2>Hồ sơ hợp tác đang chờ</h2>
            <Link className="btn btn-dark btn-sm" href="/admin/partnership/applications">Mở hộp hồ sơ</Link>
          </div>
          {recentApps.length === 0 ? <p className="muted">Không có hồ sơ nào đang chờ.</p> : (
            <div className="mini-list">
              {recentApps.map((a) => (
                <div key={a.id} className="mini-row">
                  <div><Link href={`/admin/partnership/applications/${a.id}`}><strong>{a.fullName}</strong></Link><br />
                    <span className="muted">{a.email} · {(Array.isArray(a.typesJson) ? (a.typesJson as string[]) : []).join(", ")} · {a.createdAt.toLocaleDateString("vi-VN")}</span></div>
                  <span className="crt-badge amber">{APPLICATION_STATUS[a.status]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="admin-card">
          <div className="card-head">
            <h2>Đầu việc sắp đến hạn</h2>
            <Link className="btn btn-dark btn-sm" href="/admin/partnership/deliverables">Mở trang đầu việc</Link>
          </div>
          {upcoming.length === 0 ? <p className="muted">Chưa có đầu việc nào có deadline.</p> : (
            <div className="mini-list">
              {upcoming.map((d) => (
                <div key={d.id} className="mini-row">
                  <div><strong>{d.title}</strong><br />
                    <span className="muted">{d.campaignPartner.partner.displayName} · {d.campaignPartner.campaign.name} · hạn {d.dueAt?.toLocaleDateString("vi-VN")}</span></div>
                  <span className={`crt-badge ${d.dueAt && d.dueAt < now ? "red" : "blue"}`}>{DELIVERABLE_STATUS[d.status]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
