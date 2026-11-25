import { prisma } from "@/lib/db";
import { Top, Msg } from "../../../ui";
import { decideJoinAction, saveCampaignAction } from "../actions";

export const dynamic = "force-dynamic";

const dt = (d: Date) => d.toISOString().slice(0, 10);

export default async function AdminCreatorCampaigns({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const campaigns = await prisma.creatorCampaign.findMany({ orderBy: { createdAt: "desc" }, include: { joins: { include: { creator: { select: { displayName: true, code: true } } } } } });
  return (
    <div>
      <Top title="Affiliate — Chiến dịch" />
      <Msg msg={msg} err={err} />
      {campaigns.map((c) => (
        <div className="admin-card" key={c.id}>
          <form action={saveCampaignAction}>
            <input type="hidden" name="id" value={c.id} />
            <div className="form-grid">
              <div className="field"><label>Tên chiến dịch</label><input name="name" defaultValue={c.name} /></div>
              <div className="field"><label>Slug</label><input name="slug" defaultValue={c.slug} /></div>
              <div className="field"><label>Bắt đầu</label><input name="startAt" type="date" defaultValue={dt(c.startAt)} /></div>
              <div className="field"><label>Kết thúc</label><input name="endAt" type="date" defaultValue={dt(c.endAt)} /></div>
              <div className="field"><label>Bonus hoa hồng %</label><input name="bonus" type="number" step="0.01" defaultValue={(c.bonusBps / 100).toFixed(2)} /></div>
              <div className="field"><label>Ngân sách (USD)</label><input name="budget" type="number" step="0.01" defaultValue={(c.budgetCents / 100).toFixed(2)} /></div>
              <div className="field">
                <label>Trạng thái</label>
                <select name="status" defaultValue={c.status}>
                  {["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field"><label>Banner URL</label><input name="bannerUrl" defaultValue={c.bannerUrl} /></div>
            </div>
            <div className="field"><label>Mô tả</label><textarea name="description" rows={2} defaultValue={c.description} /></div>
            <div className="form-actions"><button className="btn btn-dark" type="submit">Lưu chiến dịch</button></div>
          </form>
          {c.joins.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead><tr><th>Creator đăng ký</th><th>Trạng thái</th><th></th></tr></thead>
                <tbody>
                  {c.joins.map((j) => (
                    <tr key={j.id}>
                      <td>{j.creator.displayName} <span className="muted">({j.creator.code})</span></td>
                      <td>{j.status}</td>
                      <td>
                        {j.status === "PENDING" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <form action={decideJoinAction}>
                              <input type="hidden" name="id" value={j.id} />
                              <input type="hidden" name="kind" value="approve" />
                              <button className="btn btn-dark btn-sm" type="submit">Duyệt</button>
                            </form>
                            <form action={decideJoinAction}>
                              <input type="hidden" name="id" value={j.id} />
                              <input type="hidden" name="kind" value="reject" />
                              <button className="btn btn-outline btn-sm" type="submit">Từ chối</button>
                            </form>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
      <div className="admin-card">
        <h2>Tạo chiến dịch mới</h2>
        <form action={saveCampaignAction}>
          <div className="form-grid">
            <div className="field"><label>Tên chiến dịch</label><input name="name" required /></div>
            <div className="field"><label>Slug</label><input name="slug" required placeholder="black-friday-2026" /></div>
            <div className="field"><label>Bắt đầu</label><input name="startAt" type="date" required /></div>
            <div className="field"><label>Kết thúc</label><input name="endAt" type="date" required /></div>
            <div className="field"><label>Bonus hoa hồng %</label><input name="bonus" type="number" step="0.01" defaultValue="0" /></div>
            <div className="field"><label>Ngân sách (USD)</label><input name="budget" type="number" step="0.01" defaultValue="0" /></div>
            <div className="field">
              <label>Trạng thái</label>
              <select name="status" defaultValue="DRAFT">
                {["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Banner URL</label><input name="bannerUrl" /></div>
          </div>
          <div className="field"><label>Mô tả</label><textarea name="description" rows={2} /></div>
          <div className="form-actions"><button className="btn btn-dark" type="submit">Tạo chiến dịch</button></div>
        </form>
      </div>
    </div>
  );
}
