import Link from "next/link";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../../ui";
import { fmtUSD } from "@/lib/money";

export const dynamic = "force-dynamic";

const APP_STATUS: Record<string, string> = { SUBMITTED: "Chờ duyệt", UNDER_REVIEW: "Đang xét duyệt", NEEDS_INFO: "Cần bổ sung", APPROVED: "Đã duyệt", REJECTED: "Đã từ chối" };
const AFFILIATE_OPEN: import("@prisma/client").Prisma.PartnerApplicationWhereInput = {
  typesJson: { array_contains: "AFFILIATE" },
  status: { in: ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO"] },
};

export default async function AdminCreatorOverview({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const [totalCreators, activeCreators, pendingApps, revenueAgg, commissionAgg, pendingPayouts, activeCampaigns] = await Promise.all([
    prisma.creator.count(),
    prisma.creator.count({ where: { status: "ACTIVE" } }),
    prisma.partnerApplication.count({ where: AFFILIATE_OPEN }),
    prisma.creatorCommission.aggregate({ where: { status: { not: "REVERSED" } }, _sum: { eligibleCents: true } }),
    prisma.creatorCommission.aggregate({ where: { status: { not: "REVERSED" } }, _sum: { amountCents: true } }),
    prisma.creatorPayout.count({ where: { status: { in: ["PENDING", "APPROVED", "PROCESSING"] } } }),
    prisma.creatorCampaign.count({ where: { status: "ACTIVE" } }),
  ]);
  const [recentApps, recentCreators] = await Promise.all([
    prisma.partnerApplication.findMany({ where: AFFILIATE_OPEN, orderBy: { createdAt: "asc" }, take: 5 }),
    prisma.creator.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { level: true, _count: { select: { commissions: true, clicks: true } } } }),
  ]);

  return (
    <div>
      <Top title="Affiliate — Tổng quan" />
      <Msg msg={msg} err={err} />
      <div className="stat-grid">
        <div className="stat-card"><span>Tổng Affiliate</span><strong>{totalCreators}</strong></div>
        <div className="stat-card"><span>Đang hoạt động</span><strong>{activeCreators}</strong></div>
        <div className="stat-card"><span>Đơn chờ duyệt</span><strong>{pendingApps}</strong></div>
        <div className="stat-card"><span>Doanh thu affiliate</span><strong>{fmtUSD(revenueAgg._sum.eligibleCents ?? 0)}</strong></div>
        <div className="stat-card"><span>Tổng hoa hồng</span><strong>{fmtUSD(commissionAgg._sum.amountCents ?? 0)}</strong></div>
        <div className="stat-card"><span>Rút tiền chờ xử lý</span><strong>{pendingPayouts}</strong></div>
        <div className="stat-card"><span>Chiến dịch đang chạy</span><strong>{activeCampaigns}</strong></div>
      </div>

      <div className="admin-cols">
        <div className="admin-card">
          <div className="card-head">
            <h2>Đơn đăng ký chờ duyệt</h2>
            <Link className="btn btn-dark btn-sm" href="/admin/partnership/applications">Mở trang duyệt đơn</Link>
          </div>
          {recentApps.length === 0 ? <p className="muted">Không có đơn nào đang chờ.</p> : (
            <div className="mini-list">
              {recentApps.map((a) => (
                <div key={a.id} className="mini-row">
                  <div><strong>{a.fullName}</strong><br /><span className="muted">{a.email} · {a.createdAt.toLocaleDateString("vi-VN")}</span></div>
                  <span className="crt-badge amber">{APP_STATUS[a.status]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="admin-card">
          <div className="card-head">
            <h2>Creator mới nhất</h2>
            <Link className="btn btn-dark btn-sm" href="/admin/partnership/affiliate/list">Xem danh sách</Link>
          </div>
          {recentCreators.length === 0 ? <p className="muted">Chưa có Affiliate nào.</p> : (
            <div className="mini-list">
              {recentCreators.map((c) => (
                <div key={c.id} className="mini-row">
                  <div><Link href={`/admin/partnership/affiliate/${c.id}`}><strong>{c.displayName}</strong></Link><br /><span className="muted">{c.code} · {c._count.clicks.toLocaleString()} click · {c._count.commissions} hoa hồng</span></div>
                  <span className="crt-badge blue">{c.level?.name ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
