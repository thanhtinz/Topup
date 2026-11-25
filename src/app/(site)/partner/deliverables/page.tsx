import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPartnerForUser, fmtDate } from "@/lib/partner-portal";
import { DELIVERABLE_STATUS } from "@/lib/partnership";
import { submitDeliverableAction } from "../actions";

export const dynamic = "force-dynamic";

const card: React.CSSProperties = { border: "1px solid #E3E8EF", borderRadius: 16, padding: "20px 22px", background: "#fff", marginBottom: 14 };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid #CBD5E1", borderRadius: 10, fontSize: 14, boxSizing: "border-box" };

export default async function PartnerDeliverablesPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const partner = await getPartnerForUser(user.id);
  if (!partner || partner.status === "SUSPENDED") return null;
  const sp = await searchParams;
  const now = new Date();
  const items = await prisma.deliverable.findMany({
    where: { campaignPartner: { partnerId: partner.id } },
    include: { campaignPartner: { include: { campaign: { select: { name: true, code: true } } } } },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      {sp.msg && <p style={{ background: "#ECFDF3", border: "1px solid #ABEFC6", borderRadius: 10, padding: "10px 12px" }}>{sp.msg}</p>}
      {sp.err && <p style={{ background: "#FDF1F1", border: "1px solid #F3C2C2", borderRadius: 10, padding: "10px 12px" }}>{sp.err}</p>}
      {items.length === 0 && (
        <div style={card}><p style={{ margin: 0, color: "#68707A" }}>Chưa có đầu việc nào được giao cho bạn.</p></div>
      )}
      {items.map((d) => {
        const overdue = d.dueAt && d.dueAt < now && !["APPROVED", "REJECTED"].includes(d.status);
        const canSubmit = d.status === "PENDING" || d.status === "REVISION_REQUIRED";
        return (
          <article key={d.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{d.title}</h3>
              <span style={{ fontSize: 13, color: overdue ? "#B91C1C" : "#425466", fontWeight: overdue ? 700 : 400 }}>
                {DELIVERABLE_STATUS[d.status] ?? d.status} · Hạn {fmtDate(d.dueAt)}{overdue ? " — ĐÃ QUÁ HẠN" : ""}
              </span>
            </div>
            <p style={{ color: "#68707A", fontSize: 14, margin: "6px 0" }}>Chiến dịch: {d.campaignPartner.campaign.name} ({d.campaignPartner.campaign.code})</p>
            {d.description && <p style={{ color: "#425466", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{d.description}</p>}
            {d.submittedUrl && (
              <p style={{ margin: "8px 0", fontSize: 14 }}>
                Link đã nộp: <a href={d.submittedUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>{d.submittedUrl}</a>
              </p>
            )}
            {d.submittedNote && <p style={{ color: "#425466", fontSize: 14, margin: "6px 0" }}>Ghi chú đã nộp: {d.submittedNote}</p>}
            {(d.status === "REVISION_REQUIRED" || d.status === "REJECTED") && d.reviewNote && (
              <p style={{ background: "#FFFAEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}>
                Phản hồi từ đội Partnership: {d.reviewNote}
              </p>
            )}
            {d.status === "APPROVED" && (
              <p style={{ background: "#ECFDF3", border: "1px solid #ABEFC6", borderRadius: 10, padding: "10px 12px", fontSize: 14, margin: 0 }}>
                Đầu việc đã được nghiệm thu{d.reviewNote ? `: ${d.reviewNote}` : "."}
              </p>
            )}
            {canSubmit && (
              <form action={submitDeliverableAction} style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={d.id} />
                <div style={{ display: "grid", gap: 8 }}>
                  <input name="url" required style={input} placeholder="Link nội dung đã thực hiện (https://…)" defaultValue={d.status === "REVISION_REQUIRED" ? d.submittedUrl : ""} />
                  <input name="note" style={input} placeholder="Ghi chú cho đội kiểm duyệt (không bắt buộc)" />
                </div>
                <button type="submit" style={{ marginTop: 10, background: "#0B63E5", color: "#fff", border: 0, padding: "10px 16px", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>
                  {d.status === "REVISION_REQUIRED" ? "Nộp lại sau chỉnh sửa" : "Nộp đầu việc"}
                </button>
              </form>
            )}
          </article>
        );
      })}
    </div>
  );
}
