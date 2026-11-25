import Link from "next/link";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../../ui";
import { CAMPAIGN_STATUS, ensurePartnershipTypes } from "@/lib/partnership";
import { fmtUSD } from "@/lib/money";
import { savePartnerCampaignAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminPartnerCampaigns({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  await ensurePartnershipTypes();
  const [campaigns, types] = await Promise.all([
    prisma.partnerCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { _count: { select: { joins: true } } } }),
    prisma.partnershipType.findMany({ orderBy: { sort: "asc" } }),
  ]);

  return (
    <div>
      <Top title="Partnership — Chiến dịch" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <h2 style={{ marginBottom: 10 }}>Tạo chiến dịch</h2>
        <form action={savePartnerCampaignAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input name="name" required placeholder="Tên chiến dịch" style={{ flex: "2 1 240px" }} />
            <select name="typeCode" style={{ height: 46, flex: "1 1 160px" }}>
              {types.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
            <input name="budget" type="number" step="0.01" min="0" placeholder="Ngân sách (USD)" style={{ flex: "0 1 150px" }} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input name="objective" placeholder="Mục tiêu (VD: tăng nhận diện game X)" style={{ flex: "2 1 240px" }} />
            <label style={{ fontSize: 13 }}>Từ <input name="startAt" type="date" /></label>
            <label style={{ fontSize: 13 }}>Đến <input name="endAt" type="date" /></label>
          </div>
          <textarea name="brief" rows={3} placeholder="Brief: nội dung, yêu cầu bắt buộc, thông điệp chính, điều cấm..." />
          <button className="btn btn-dark" type="submit" style={{ alignSelf: "flex-start" }}>Tạo chiến dịch (nháp)</button>
        </form>
      </div>
      <div className="admin-card">
        {campaigns.length === 0 ? <p className="muted">Chưa có chiến dịch nào.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Mã</th><th>Chiến dịch</th><th>Loại hình</th><th>Ngân sách</th><th>Partner</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.code}</strong></td>
                    <td>{c.name}<br /><span className="muted">{c.startAt ? c.startAt.toLocaleDateString("vi-VN") : "?"} → {c.endAt ? c.endAt.toLocaleDateString("vi-VN") : "?"}</span></td>
                    <td>{types.find((t) => t.code === c.typeCode)?.name ?? c.typeCode}</td>
                    <td>{c.budgetCents > 0 ? fmtUSD(c.budgetCents) : "—"}</td>
                    <td>{c._count.joins}</td>
                    <td>{CAMPAIGN_STATUS[c.status]}</td>
                    <td><Link className="btn btn-outline btn-sm" href={`/admin/partnership/campaigns/${c.id}`}>Chi tiết</Link></td>
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
