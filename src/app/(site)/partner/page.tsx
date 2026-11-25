import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPartnerForUser, fmtCur, fmtDate, JOIN_STATUS_LABEL } from "@/lib/partner-portal";
import { CAMPAIGN_STATUS, DELIVERABLE_STATUS, PAYMENT_STATUS } from "@/lib/partnership";

export const dynamic = "force-dynamic";

const card: React.CSSProperties = { border: "1px solid #E3E8EF", borderRadius: 16, padding: "18px 20px", background: "#fff" };

export default async function PartnerHomePage() {
  const user = await requireUser();
  const partner = await getPartnerForUser(user.id);
  if (!partner || partner.status === "SUSPENDED") return null;

  const now = new Date();
  const soon = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const [joins, deliverables, payments] = await Promise.all([
    prisma.campaignPartner.findMany({
      where: { partnerId: partner.id },
      include: { campaign: { select: { id: true, code: true, name: true, status: true, startAt: true, endAt: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.deliverable.findMany({
      where: { campaignPartner: { partnerId: partner.id } },
      include: { campaignPartner: { include: { campaign: { select: { name: true, code: true } } } } },
      orderBy: { dueAt: "asc" },
    }),
    prisma.partnerPayment.findMany({ where: { partnerId: partner.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const invitations = joins.filter((j) => j.status === "INVITED");
  const activeCampaigns = joins.filter((j) => j.status === "ACCEPTED").length;
  const openDeliverables = deliverables.filter((d) => ["PENDING", "SUBMITTED", "IN_REVIEW", "REVISION_REQUIRED"].includes(d.status));
  const dueSoon = openDeliverables.filter((d) => d.dueAt && d.dueAt <= soon);
  const paidByCur = new Map<string, number>();
  const pendingByCur = new Map<string, number>();
  for (const p of payments) {
    if (p.status === "PAID") paidByCur.set(p.currency, (paidByCur.get(p.currency) ?? 0) + p.amountCents);
    if (["PENDING_APPROVAL", "APPROVED", "PROCESSING"].includes(p.status)) pendingByCur.set(p.currency, (pendingByCur.get(p.currency) ?? 0) + p.amountCents);
  }
  const moneyLine = (m: Map<string, number>) => (m.size ? [...m.entries()].map(([c, v]) => fmtCur(v, c)).join(" · ") : fmtCur(0, "USD"));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <div style={card}>
          <p style={{ margin: 0, color: "#68707A", fontSize: 13 }}>Chiến dịch đang tham gia</p>
          <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 700 }}>{activeCampaigns}</p>
          {invitations.length > 0 && <p style={{ margin: "6px 0 0", fontSize: 13, color: "#B45309" }}>{invitations.length} lời mời chờ phản hồi</p>}
        </div>
        <div style={card}>
          <p style={{ margin: 0, color: "#68707A", fontSize: 13 }}>Đầu việc đang mở</p>
          <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 700 }}>{openDeliverables.length}</p>
          {dueSoon.length > 0 && <p style={{ margin: "6px 0 0", fontSize: 13, color: "#B45309" }}>{dueSoon.length} việc đến hạn trong 7 ngày</p>}
        </div>
        <div style={card}>
          <p style={{ margin: 0, color: "#68707A", fontSize: 13 }}>Chờ thanh toán</p>
          <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 700 }}>{moneyLine(pendingByCur)}</p>
        </div>
        <div style={card}>
          <p style={{ margin: 0, color: "#68707A", fontSize: 13 }}>Đã thanh toán</p>
          <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 700 }}>{moneyLine(paidByCur)}</p>
        </div>
      </div>

      {invitations.length > 0 && (
        <section style={{ ...card, marginTop: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 17 }}>Lời mời tham gia chiến dịch</h2>
          {invitations.map((j) => (
            <p key={j.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", margin: "10px 0" }}>
              <span>{j.campaign.name} <span style={{ color: "#68707A" }}>({j.campaign.code})</span></span>
              <Link href="/partner/campaigns" style={{ fontWeight: 600 }}>Xem và phản hồi →</Link>
            </p>
          ))}
        </section>
      )}

      <section style={{ ...card, marginTop: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Đầu việc sắp đến hạn</h2>
        {dueSoon.length === 0 ? (
          <p style={{ color: "#68707A", margin: 0 }}>Không có đầu việc nào đến hạn trong 7 ngày tới.</p>
        ) : (
          dueSoon.slice(0, 5).map((d) => (
            <p key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", margin: "10px 0" }}>
              <span>{d.title} <span style={{ color: "#68707A" }}>· {d.campaignPartner.campaign.name}</span></span>
              <span style={{ color: d.dueAt && d.dueAt < now ? "#B91C1C" : "#425466" }}>
                {DELIVERABLE_STATUS[d.status] ?? d.status} · Hạn {fmtDate(d.dueAt)}
              </span>
            </p>
          ))
        )}
        <p style={{ margin: "12px 0 0" }}><Link href="/partner/deliverables" style={{ fontWeight: 600 }}>Xem tất cả đầu việc →</Link></p>
      </section>

      <section style={{ ...card, marginTop: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Thanh toán gần đây</h2>
        {payments.length === 0 ? (
          <p style={{ color: "#68707A", margin: 0 }}>Chưa có khoản thanh toán nào.</p>
        ) : (
          payments.slice(0, 5).map((p) => (
            <p key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", margin: "10px 0" }}>
              <span>{fmtCur(p.amountCents, p.currency)}</span>
              <span style={{ color: "#425466" }}>{PAYMENT_STATUS[p.status] ?? p.status} · {fmtDate(p.createdAt)}</span>
            </p>
          ))
        )}
        <p style={{ margin: "12px 0 0" }}><Link href="/partner/financials" style={{ fontWeight: 600 }}>Xem toàn bộ thanh toán →</Link></p>
      </section>

      <p style={{ marginTop: 18, color: "#68707A", fontSize: 13 }}>
        Trạng thái lời mời: {Object.values(JOIN_STATUS_LABEL).slice(0, 2).join(" · ")} — quản lý ở mục Chiến dịch. Thông báo hệ thống nằm ở chuông thông báo trên đầu trang.
      </p>
    </div>
  );
}
