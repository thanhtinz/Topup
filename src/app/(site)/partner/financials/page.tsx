import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPartnerForUser, fmtCur, fmtDate } from "@/lib/partner-portal";
import { PAYMENT_STATUS, PAYMENT_TYPE } from "@/lib/partnership";

export const dynamic = "force-dynamic";

const card: React.CSSProperties = { border: "1px solid #E3E8EF", borderRadius: 16, padding: "20px 22px", background: "#fff", marginBottom: 14 };

export default async function PartnerFinancialsPage() {
  const user = await requireUser();
  const partner = await getPartnerForUser(user.id);
  if (!partner || partner.status === "SUSPENDED") return null;
  const payments = await prisma.partnerPayment.findMany({
    where: { partnerId: partner.id, status: { not: "DRAFT" } },
    include: {
      campaign: { select: { name: true, code: true } },
      agreement: { select: { title: true } },
      deliverable: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totals = new Map<string, Map<string, number>>();
  for (const p of payments) {
    const byStatus = totals.get(p.currency) ?? new Map<string, number>();
    byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + p.amountCents);
    totals.set(p.currency, byStatus);
  }

  return (
    <div>
      {totals.size > 0 && (
        <div style={{ ...card, display: "flex", gap: 28, flexWrap: "wrap" }}>
          {[...totals.entries()].map(([cur, byStatus]) => (
            <div key={cur}>
              <p style={{ margin: 0, color: "#68707A", fontSize: 13 }}>Tổng theo {cur}</p>
              <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.7 }}>
                Đã thanh toán: <b>{fmtCur(byStatus.get("PAID") ?? 0, cur)}</b><br />
                Chờ xử lý: <b>{fmtCur((byStatus.get("PENDING_APPROVAL") ?? 0) + (byStatus.get("APPROVED") ?? 0) + (byStatus.get("PROCESSING") ?? 0), cur)}</b>
              </p>
            </div>
          ))}
        </div>
      )}
      {payments.length === 0 && (
        <div style={card}><p style={{ margin: 0, color: "#68707A" }}>Chưa có khoản thanh toán nào.</p></div>
      )}
      {payments.map((p) => (
        <article key={p.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 17 }}>{fmtCur(p.amountCents, p.currency)}</h3>
            <span style={{ fontSize: 13, color: "#425466" }}>{PAYMENT_STATUS[p.status] ?? p.status}</span>
          </div>
          <p style={{ color: "#68707A", fontSize: 14, margin: "8px 0", lineHeight: 1.7 }}>
            Loại: {PAYMENT_TYPE[p.type] ?? p.type}
            {p.campaign ? <><br />Chiến dịch: {p.campaign.name} ({p.campaign.code})</> : null}
            {p.agreement ? <><br />Thỏa thuận: {p.agreement.title}</> : null}
            {p.deliverable ? <><br />Đầu việc: {p.deliverable.title}</> : null}
            {p.dueAt ? <><br />Hạn thanh toán: {fmtDate(p.dueAt)}</> : null}
            {p.status === "PAID" && p.paidAt ? <><br />Đã chi ngày: {fmtDate(p.paidAt)}{p.method ? ` · qua ${p.method}` : ""}{p.txRef ? ` · Mã giao dịch: ${p.txRef}` : ""}</> : null}
            {p.note ? <><br />Ghi chú: {p.note}</> : null}
          </p>
          {p.receiptUrl && (
            <p style={{ margin: 0 }}><a href={p.receiptUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>Xem biên lai</a></p>
          )}
        </article>
      ))}
      <p style={{ color: "#68707A", fontSize: 13 }}>
        Hệ thống chỉ ghi nhận yêu cầu và trạng thái thanh toán; khoản chi thực tế do đội Partnership xử lý qua kênh đã thỏa thuận và cập nhật mã giao dịch tại đây.
      </p>
    </div>
  );
}
