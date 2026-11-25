import { prisma } from "@/lib/db";
import { Top, Msg } from "../../ui";
import { PROPOSAL_STATUS } from "@/lib/partnership";
import { fmtUSD } from "@/lib/money";
import { saveProposalAction, setProposalStatusAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminProposals({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const [proposals, partners] = await Promise.all([
    prisma.proposal.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { partner: { select: { id: true, displayName: true } } } }),
    prisma.partner.findMany({ where: { status: "ACTIVE" }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true } }),
  ]);

  return (
    <div>
      <Top title="Partnership — Đề xuất & thương lượng" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <h2 style={{ marginBottom: 10 }}>Tạo đề xuất / báo giá</h2>
        <form action={saveProposalAction} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select name="partnerId" required style={{ height: 38, flex: "1 1 180px" }}>
            <option value="">Chọn Partner...</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
          <input name="title" required placeholder="Tiêu đề đề xuất" style={{ flex: "2 1 220px" }} />
          <input name="price" type="number" step="0.01" min="0" placeholder="Giá (USD)" style={{ width: 120 }} />
          <input name="expiresAt" type="date" title="Hạn hiệu lực" style={{ width: 160 }} />
          <input name="scopeText" placeholder="Phạm vi công việc tóm tắt" style={{ flex: "2 1 220px" }} />
          <button className="btn btn-dark btn-sm" type="submit">Tạo đề xuất</button>
        </form>
      </div>
      <div className="admin-card">
        {proposals.length === 0 ? <p className="muted">Chưa có đề xuất nào.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Đề xuất</th><th>Partner</th><th>Giá</th><th>Trạng thái</th><th>Hạn</th><th style={{ minWidth: 260 }}>Thao tác</th></tr></thead>
              <tbody>
                {proposals.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.title}</strong>{p.scopeText && <><br /><span className="muted">{p.scopeText}</span></>}</td>
                    <td>{p.partner.displayName}</td>
                    <td>{p.priceCents > 0 ? fmtUSD(p.priceCents) : "—"} {p.currency !== "USD" ? p.currency : ""}</td>
                    <td>{PROPOSAL_STATUS[p.status]}</td>
                    <td>{p.expiresAt ? p.expiresAt.toLocaleDateString("vi-VN") : "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {p.status === "DRAFT" && (
                          <form action={setProposalStatusAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="kind" value="send" /><button className="btn btn-dark btn-sm" type="submit">Gửi đối tác</button></form>
                        )}
                        {["SENT", "COUNTERED"].includes(p.status) && (
                          <>
                            <form action={setProposalStatusAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="kind" value="accept" /><button className="btn btn-dark btn-sm" type="submit">Chấp nhận</button></form>
                            <form action={setProposalStatusAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="kind" value="counter" /><button className="btn btn-outline btn-sm" type="submit">Đối tác phản hồi giá</button></form>
                            <form action={setProposalStatusAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="kind" value="decline" /><button className="btn btn-outline btn-sm" type="submit">Từ chối</button></form>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
