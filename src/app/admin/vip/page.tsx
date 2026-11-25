import { prisma } from "@/lib/db";
import { Top, Msg } from "../ui";
import { saveVipTiersAction, addVipTierAction, deleteVipTierAction, uploadTierIconAction, removeTierIconAction } from "../actions";

export const dynamic = "force-dynamic";

const crownSmall = (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7Z" /><path d="M5 20h14" /></svg>
);

export default async function VipAdminPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const tiers = await prisma.vipTier.findMany({ orderBy: [{ thresholdCents: "asc" }, { sort: "asc" }] });
  return (
    <div>
      <Top title="Quản lý VIP" />
      <Msg msg={msg} err={err} />

      <div className="admin-card">
        <h3 style={{ margin: "0 0 4px" }}>Icon từng cấp VIP</h3>
        <p className="muted" style={{ marginBottom: 12 }}>Mỗi cấp một icon riêng — icon hiện ở thẻ hạng của cấp đó trong trang Câu lạc bộ và ở banner hồ sơ khi khách đang ở cấp đó. Cấp chưa tải icon thì dùng vương miện mặc định.</p>
        <div style={{ display: "grid", gap: 10 }}>
          {tiers.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", border: "1px solid var(--aline)", borderRadius: 12, padding: "10px 14px" }}>
              <div style={{ width: 52, height: 52, border: "1px solid var(--aline)", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFF9F1", flex: "none" }}>
                {t.iconUrl ? <img src={t.iconUrl} alt={`Icon ${t.name}`} style={{ width: 38, height: 38, objectFit: "contain" }} /> : crownSmall}
              </div>
              <b style={{ minWidth: 52 }}>{t.name}</b>
              <form action={uploadTierIconAction} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type="hidden" name="tierId" value={t.id} />
                <input type="file" name="icon" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" required style={{ fontSize: 13 }} />
                <button className="btn btn-dark btn-sm" type="submit">Tải lên</button>
              </form>
              {t.iconUrl && (
                <form action={removeTierIconAction}>
                  <input type="hidden" name="tierId" value={t.id} />
                  <button className="btn btn-outline btn-sm" type="submit">Gỡ icon</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>

      <form action={saveVipTiersAction} className="admin-card">
        <h3 style={{ margin: "0 0 4px" }}>Các cấp VIP</h3>
        <p className="muted" style={{ marginBottom: 12 }}>Hạng của khách tính theo tổng chi tiêu 30 ngày gần nhất. % giảm áp tự động vào mọi đơn của khách ở cấp đó. Phải có đúng 1 cấp nền ngưỡng $0, các ngưỡng tăng dần.</p>
        <input type="hidden" name="ids" value={tiers.map((t) => t.id).join(",")} />
        <div className="table-wrap">
          <table>
            <thead><tr><th>Cấp</th><th>Ngưỡng chi tiêu 30 ngày (USD)</th><th>Giảm giá mỗi đơn (%)</th><th>Mã tháng (%)</th><th>Bồi thường chậm</th><th></th></tr></thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.id}>
                  <td><input name={`name_${t.id}`} defaultValue={t.name} style={{ width: 110, height: 36, border: "1px solid var(--aline)", borderRadius: 8, padding: "0 9px", fontWeight: 700 }} /></td>
                  <td><input name={`th_${t.id}`} type="number" min={0} step="0.01" defaultValue={t.thresholdCents / 100} style={{ width: 130, height: 36, border: "1px solid var(--aline)", borderRadius: 8, padding: "0 9px" }} /></td>
                  <td><input name={`disc_${t.id}`} type="number" min={0} max={100} defaultValue={t.discountPercent} style={{ width: 90, height: 36, border: "1px solid var(--aline)", borderRadius: 8, padding: "0 9px" }} /></td>
                  <td><input name={`coup_${t.id}`} type="number" min={0} max={100} defaultValue={t.couponPercent} style={{ width: 90, height: 36, border: "1px solid var(--aline)", borderRadius: 8, padding: "0 9px" }} /></td>
                  <td><input type="checkbox" name={`late_${t.id}`} value="1" defaultChecked={t.lateComp} style={{ width: 19, height: 19, accentColor: "var(--aaccent)" }} /></td>
                  <td>
                    {t.thresholdCents > 0 && (
                      <button className="btn btn-ghost btn-sm" type="submit" formAction={deleteVipTierAction} name="id" value={t.id} style={{ color: "#B3261E" }}>Xoá</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="form-actions">
          <button className="btn btn-dark" type="submit">Lưu tất cả cấp</button>
        </div>
      </form>

      <form action={addVipTierAction} className="admin-card">
        <h3 style={{ margin: "0 0 10px" }}>Thêm cấp mới</h3>
        <div className="form-grid">
          <div className="field"><label>Tên cấp</label><input name="name" placeholder="VD: V5, Diamond…" required /></div>
          <div className="field"><label>Ngưỡng chi tiêu 30 ngày (USD)</label><input name="threshold" type="number" min={0} step="0.01" placeholder="VD: 1000" required /></div>
        </div>
        <div className="form-actions">
          <button className="btn btn-dark" type="submit">Thêm cấp</button>
        </div>
      </form>
    </div>
  );
}
