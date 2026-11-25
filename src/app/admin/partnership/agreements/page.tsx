import Link from "next/link";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../../ui";
import { AGREEMENT_STATUS } from "@/lib/partnership";
import { fmtUSD } from "@/lib/money";
import { saveAgreementAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminAgreements({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const [agreements, partners, campaigns] = await Promise.all([
    prisma.agreement.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { partner: { select: { id: true, displayName: true } }, campaign: { select: { name: true, code: true } } } }),
    prisma.partner.findMany({ where: { status: "ACTIVE" }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true } }),
    prisma.partnerCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, name: true, code: true } }),
  ]);

  return (
    <div>
      <Top title="Partnership — Thỏa thuận & hợp đồng" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <h2 style={{ marginBottom: 10 }}>Tạo thỏa thuận</h2>
        <form action={saveAgreementAction} encType="multipart/form-data" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select name="partnerId" required style={{ height: 46, flex: "1 1 180px" }}>
              <option value="">Chọn Partner...</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
            <select name="campaignId" style={{ height: 46, flex: "1 1 180px" }}>
              <option value="">Không gắn chiến dịch</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
            <input name="title" required placeholder="Tiêu đề thỏa thuận" style={{ flex: "2 1 220px" }} />
          </div>
          <textarea name="scopeText" rows={3} placeholder="Phạm vi công việc, đầu việc, KPI, lịch triển khai..." />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input name="fee" type="number" step="0.01" min="0" placeholder="Phí thỏa thuận (USD)" style={{ width: 170 }} />
            <select name="status" style={{ height: 46 }}>
              <option value="DRAFT">Bản nháp</option>
              <option value="SENT">Đã gửi đối tác</option>
              <option value="CONFIRMED">Đã xác nhận</option>
            </select>
            <label style={{ fontSize: 13 }}>Hiệu lực từ <input name="effectiveAt" type="date" /></label>
            <label style={{ fontSize: 13 }}>Đến <input name="expiresAt" type="date" /></label>
          </div>
          <textarea name="contentRightsText" rows={2} placeholder="Quyền sử dụng nội dung: thời hạn, nền tảng, quyền chỉnh sửa/quảng cáo..." />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ fontSize: 13.5 }}>File hợp đồng (PDF/Word/ảnh, ≤10MB): <input name="contractFile" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" /></label>
            <input name="contractFileUrl" placeholder="hoặc dán URL file có sẵn" style={{ flex: "1 1 220px" }} />
          </div>
          <button className="btn btn-dark" type="submit" style={{ alignSelf: "flex-start" }}>Tạo thỏa thuận</button>
        </form>
      </div>
      <div className="admin-card">
        {agreements.length === 0 ? <p className="muted">Chưa có thỏa thuận nào.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Thỏa thuận</th><th>Partner</th><th>Chiến dịch</th><th>Phí</th><th>Trạng thái</th><th>Hiệu lực</th><th>File</th></tr></thead>
              <tbody>
                {agreements.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.title}</strong> <span className="muted">v{a.version}</span>{a.scopeText && <><br /><span className="muted">{a.scopeText.slice(0, 90)}</span></>}</td>
                    <td><Link href={`/admin/partnership/partners/${a.partner.id}`}>{a.partner.displayName}</Link></td>
                    <td>{a.campaign ? `${a.campaign.code}` : "—"}</td>
                    <td>{a.feeCents > 0 ? fmtUSD(a.feeCents) : "—"}</td>
                    <td>{AGREEMENT_STATUS[a.status]}</td>
                    <td>{a.effectiveAt ? a.effectiveAt.toLocaleDateString("vi-VN") : "?"} → {a.expiresAt ? a.expiresAt.toLocaleDateString("vi-VN") : "?"}</td>
                    <td>{a.contractFileUrl ? <a href={a.contractFileUrl} target="_blank" rel="noreferrer">{a.contractFileName || "Xem file"}</a> : "—"}</td>
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
