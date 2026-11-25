import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPartnerForUser, fmtCur, fmtDate } from "@/lib/partner-portal";
import { AGREEMENT_STATUS } from "@/lib/partnership";

export const dynamic = "force-dynamic";

const card: React.CSSProperties = { border: "1px solid #E3E8EF", borderRadius: 16, padding: "20px 22px", background: "#fff", marginBottom: 14 };

export default async function PartnerDocumentsPage() {
  const user = await requireUser();
  const partner = await getPartnerForUser(user.id);
  if (!partner || partner.status === "SUSPENDED") return null;
  const agreements = await prisma.agreement.findMany({
    where: { partnerId: partner.id, status: { not: "DRAFT" } },
    include: { campaign: { select: { name: true, code: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      {agreements.length === 0 && (
        <div style={card}><p style={{ margin: 0, color: "#68707A" }}>Chưa có thỏa thuận nào được gửi cho bạn.</p></div>
      )}
      {agreements.map((a) => (
        <article key={a.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>{a.title}</h3>
            <span style={{ fontSize: 13, color: "#425466" }}>{AGREEMENT_STATUS[a.status] ?? a.status} · Phiên bản {a.version}</span>
          </div>
          <p style={{ color: "#68707A", fontSize: 14, margin: "8px 0" }}>
            {a.campaign ? `Chiến dịch: ${a.campaign.name} (${a.campaign.code}) · ` : ""}
            Phí thỏa thuận: <b>{fmtCur(a.feeCents, a.currency)}</b> · Hiệu lực: {fmtDate(a.effectiveAt)} → {fmtDate(a.expiresAt)}
          </p>
          {a.scopeText && <p style={{ color: "#425466", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{a.scopeText}</p>}
          {a.contentRightsText && (
            <p style={{ color: "#425466", lineHeight: 1.6, whiteSpace: "pre-wrap", fontSize: 14 }}>Quyền sử dụng nội dung: {a.contentRightsText}</p>
          )}
          {a.contractFileUrl ? (
            <p style={{ margin: "10px 0 0" }}>
              <a href={a.contractFileUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                Tải file hợp đồng{a.contractFileName ? ` (${a.contractFileName})` : ""}
              </a>
            </p>
          ) : (
            <p style={{ color: "#68707A", fontSize: 14, margin: "10px 0 0" }}>Chưa có file hợp đồng đính kèm.</p>
          )}
        </article>
      ))}
    </div>
  );
}
