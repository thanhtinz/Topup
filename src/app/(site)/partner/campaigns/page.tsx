import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPartnerForUser, fmtDate, JOIN_STATUS_LABEL } from "@/lib/partner-portal";
import { CAMPAIGN_STATUS } from "@/lib/partnership";
import { respondJoinAction } from "../actions";

export const dynamic = "force-dynamic";

const card: React.CSSProperties = { border: "1px solid #E3E8EF", borderRadius: 16, padding: "20px 22px", background: "#fff", marginBottom: 14 };

export default async function PartnerCampaignsPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const partner = await getPartnerForUser(user.id);
  if (!partner || partner.status === "SUSPENDED") return null;
  const sp = await searchParams;
  const joins = await prisma.campaignPartner.findMany({
    where: { partnerId: partner.id },
    include: {
      campaign: { select: { id: true, code: true, name: true, status: true, objective: true, startAt: true, endAt: true } },
      deliverables: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      {sp.msg && <p style={{ background: "#ECFDF3", border: "1px solid #ABEFC6", borderRadius: 10, padding: "10px 12px" }}>{sp.msg}</p>}
      {sp.err && <p style={{ background: "#FDF1F1", border: "1px solid #F3C2C2", borderRadius: 10, padding: "10px 12px" }}>{sp.err}</p>}
      {joins.length === 0 && (
        <div style={card}>
          <p style={{ margin: 0, color: "#68707A" }}>Bạn chưa được mời vào chiến dịch nào. Khi đội Partnership mời, lời mời sẽ hiện ở đây.</p>
        </div>
      )}
      {joins.map((j) => {
        const done = j.deliverables.filter((d) => d.status === "APPROVED").length;
        return (
          <article key={j.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>
                <Link href={`/partner/campaigns/${j.campaign.id}`} style={{ textDecoration: "none" }}>{j.campaign.name}</Link>
              </h3>
              <span style={{ fontSize: 13, color: "#425466" }}>{j.campaign.code} · {CAMPAIGN_STATUS[j.campaign.status] ?? j.campaign.status}</span>
            </div>
            {j.campaign.objective && <p style={{ color: "#425466", lineHeight: 1.6 }}>{j.campaign.objective}</p>}
            <p style={{ color: "#68707A", fontSize: 14, margin: "8px 0" }}>
              Thời gian: {fmtDate(j.campaign.startAt)} → {fmtDate(j.campaign.endAt)} · Đầu việc đã nghiệm thu: {done}/{j.deliverables.length}
            </p>
            <p style={{ margin: "8px 0", fontWeight: 600 }}>{JOIN_STATUS_LABEL[j.status] ?? j.status}</p>
            {j.status === "INVITED" && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <form action={respondJoinAction}>
                  <input type="hidden" name="kind" value="accept" />
                  <input type="hidden" name="joinId" value={j.id} />
                  <button type="submit" style={{ background: "#0B63E5", color: "#fff", border: 0, padding: "10px 16px", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>Nhận tham gia</button>
                </form>
                <form action={respondJoinAction}>
                  <input type="hidden" name="kind" value="decline" />
                  <input type="hidden" name="joinId" value={j.id} />
                  <button type="submit" style={{ background: "#EEF2F7", color: "#1F2A37", border: 0, padding: "10px 16px", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>Từ chối</button>
                </form>
              </div>
            )}
            {j.status === "ACCEPTED" && (
              <p style={{ margin: "10px 0 0" }}><Link href={`/partner/campaigns/${j.campaign.id}`} style={{ fontWeight: 600 }}>Xem brief và đầu việc →</Link></p>
            )}
          </article>
        );
      })}
    </div>
  );
}
