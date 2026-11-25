import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPartnerForUser, fmtDate, JOIN_STATUS_LABEL } from "@/lib/partner-portal";
import { CAMPAIGN_STATUS, DELIVERABLE_STATUS, AGREEMENT_STATUS } from "@/lib/partnership";

export const dynamic = "force-dynamic";

const card: React.CSSProperties = { border: "1px solid #E3E8EF", borderRadius: 16, padding: "20px 22px", background: "#fff", marginBottom: 14 };

export default async function PartnerCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const partner = await getPartnerForUser(user.id);
  if (!partner || partner.status === "SUSPENDED") return null;
  const { id } = await params;
  const join = await prisma.campaignPartner.findFirst({
    where: { partnerId: partner.id, campaignId: Number(id) },
    include: {
      campaign: true,
      deliverables: { orderBy: { dueAt: "asc" } },
    },
  });
  if (!join) notFound();
  const c = join.campaign;
  const agreements = await prisma.agreement.findMany({
    where: { partnerId: partner.id, campaignId: c.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <p style={{ marginTop: 0 }}><Link href="/partner/campaigns" style={{ fontWeight: 600 }}>← Tất cả chiến dịch</Link></p>
      <article style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{c.name}</h2>
          <span style={{ fontSize: 13, color: "#425466" }}>{c.code} · {CAMPAIGN_STATUS[c.status] ?? c.status}</span>
        </div>
        <p style={{ color: "#68707A", fontSize: 14 }}>
          Thời gian: {fmtDate(c.startAt)} → {fmtDate(c.endAt)} · Trạng thái tham gia: <b>{JOIN_STATUS_LABEL[join.status] ?? join.status}</b>
        </p>
        {c.objective && (
          <>
            <h3 style={{ fontSize: 16, marginBottom: 6 }}>Mục tiêu</h3>
            <p style={{ color: "#425466", lineHeight: 1.6, whiteSpace: "pre-wrap", marginTop: 0 }}>{c.objective}</p>
          </>
        )}
        {c.brief && (
          <>
            <h3 style={{ fontSize: 16, marginBottom: 6 }}>Brief</h3>
            <p style={{ color: "#425466", lineHeight: 1.6, whiteSpace: "pre-wrap", marginTop: 0 }}>{c.brief}</p>
          </>
        )}
      </article>

      <article style={card}>
        <h3 style={{ marginTop: 0, fontSize: 16 }}>Đầu việc của bạn trong chiến dịch này</h3>
        {join.deliverables.length === 0 ? (
          <p style={{ color: "#68707A", margin: 0 }}>Chưa có đầu việc nào được giao.</p>
        ) : (
          join.deliverables.map((d) => (
            <p key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", margin: "10px 0" }}>
              <span>{d.title}</span>
              <span style={{ color: "#425466" }}>{DELIVERABLE_STATUS[d.status] ?? d.status} · Hạn {fmtDate(d.dueAt)}</span>
            </p>
          ))
        )}
        <p style={{ margin: "12px 0 0" }}><Link href="/partner/deliverables" style={{ fontWeight: 600 }}>Nộp và quản lý đầu việc →</Link></p>
      </article>

      {agreements.length > 0 && (
        <article style={card}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Thỏa thuận liên quan</h3>
          {agreements.map((a) => (
            <p key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", margin: "10px 0" }}>
              <span>{a.title}</span>
              <span style={{ color: "#425466" }}>{AGREEMENT_STATUS[a.status] ?? a.status} · Hết hạn {fmtDate(a.expiresAt)}</span>
            </p>
          ))}
          <p style={{ margin: "12px 0 0" }}><Link href="/partner/documents" style={{ fontWeight: 600 }}>Xem ở mục Tài liệu →</Link></p>
        </article>
      )}
    </div>
  );
}
