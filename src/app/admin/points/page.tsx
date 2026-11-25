import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Top, Msg } from "../ui";
import { savePointsConfigAction, adjustPointsAction, addPointsAction, subtractPointsAction } from "../actions";

export const dynamic = "force-dynamic";

function ToggleRow({ name, label, desc, defaultChecked }: { name: string; label: string; desc: string; defaultChecked: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", border: "1px solid var(--aline)", borderRadius: 12, background: "#FAFBFE" }}>
      <input type="checkbox" name={name} value="1" defaultChecked={defaultChecked} style={{ width: 20, height: 20, accentColor: "var(--aaccent)" }} />
      <div>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{label}</div>
        <div className="muted" style={{ fontSize: 13 }}>{desc}</div>
      </div>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  EARN_REVIEW: "Đánh giá đơn hàng",
  SPEND: "Dùng điểm thanh toán",
  REFUND_RETURN: "Hoàn điểm",
  LATE_COMP: "Bồi thường chậm trễ",
  ADMIN: "Admin điều chỉnh",
};

export default async function PointsAdminPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; q?: string; tab?: string }> }) {
  const s = await getSettings();
  const { msg, err, q, tab } = await searchParams;
  const active = tab === "customers" || tab === "history" ? tab : "config";
  const query = (q ?? "").trim();
  const [agg, users, txns] = await Promise.all([
    prisma.user.aggregate({ _sum: { points: true, pointsTotalEarned: true } }),
    prisma.user.findMany({
      where: {
        role: "CUSTOMER",
        ...(query ? { OR: [{ email: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } }] } : {}),
      },
      orderBy: { points: "desc" },
      take: 50,
      select: { id: true, name: true, email: true, points: true, pointsTotalEarned: true },
    }),
    prisma.pointTxn.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { user: { select: { email: true } } } }),
  ]);
  return (
    <div>
      <Top title="Quản lý điểm" />
      <Msg msg={msg} err={err} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14, marginBottom: 16 }}>
        <div className="admin-card" style={{ margin: 0 }}><div className="muted" style={{ fontSize: 13 }}>Điểm khách đang giữ</div><div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800 }}>{(agg._sum.points ?? 0).toLocaleString("vi-VN")}</div></div>
        <div className="admin-card" style={{ margin: 0 }}><div className="muted" style={{ fontSize: 13 }}>Tổng điểm đã phát ra</div><div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800 }}>{(agg._sum.pointsTotalEarned ?? 0).toLocaleString("vi-VN")}</div></div>
      </div>

      <div className="admin-tabs">
        <Link href="/admin/points?tab=config" className={active === "config" ? "on" : ""}>Cấu hình</Link>
        <Link href="/admin/points?tab=customers" className={active === "customers" ? "on" : ""}>Điểm khách hàng</Link>
        <Link href="/admin/points?tab=history" className={active === "history" ? "on" : ""}>Lịch sử biến động</Link>
      </div>

      {active === "config" && (
      <form action={savePointsConfigAction} className="admin-card">
        <ToggleRow name="module_points" label="Bật hệ điểm & VIP" desc="Tắt thì khách không tích/dùng điểm, không áp giảm giá VIP và không hiện trang Câu lạc bộ." defaultChecked={s.module_points === "1"} />
        <div style={{ height: 14 }} />
        <h3 style={{ margin: "4px 0 10px" }}>Tích & dùng điểm</h3>
        <div className="form-grid">
          <div className="field"><label>Điểm mỗi đánh giá</label><input name="points_per_review" type="number" min={0} max={1000} defaultValue={s.points_per_review} /></div>
          <div className="field"><label>Số lần nhận điểm tối đa / ngày</label><input name="points_daily_cap" type="number" min={0} max={100} defaultValue={s.points_daily_cap} /></div>
          <div className="field"><label>Điểm trả tối đa mỗi đơn (%)</label><input name="points_max_pay_percent" type="number" min={0} max={100} defaultValue={s.points_max_pay_percent} /></div>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>100 điểm = $1.00. Khách đánh giá đơn đã giao để nhận điểm; cấu hình cấp VIP và % giảm theo cấp nằm ở trang Quản lý VIP.</p>
        <h3 style={{ margin: "18px 0 10px" }}>Bồi thường giao chậm (cho cấp VIP có bật quyền lợi)</h3>
        <div className="form-grid">
          <div className="field"><label>Giao chậm quá (giờ)</label><input name="vip_late_hours" type="number" min={1} max={720} defaultValue={s.vip_late_hours} /></div>
          <div className="field"><label>Số điểm bồi thường</label><input name="vip_late_points" type="number" min={0} max={100000} defaultValue={s.vip_late_points} /></div>
        </div>
        <div className="form-actions">
          <button className="btn btn-dark" type="submit">Lưu cấu hình</button>
        </div>
      </form>
      )}

      {active === "customers" && (
      <div className="admin-card">
        <h3 style={{ margin: "0 0 12px" }}>Số điểm của khách hàng</h3>
        <form method="get" style={{ display: "flex", gap: 9, marginBottom: 14 }}>
          <input type="hidden" name="tab" value="customers" />
          <input name="q" defaultValue={query} placeholder="Tìm theo email hoặc tên…" style={{ flex: 1, height: 40, border: "1px solid var(--aline)", borderRadius: 10, padding: "0 12px" }} />
          <button className="btn btn-dark btn-sm" type="submit">Tìm</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Khách hàng</th><th>Điểm hiện có</th><th>Đã tích tổng</th><th>Cộng / trừ điểm</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ whiteSpace: "normal" }}><b>{u.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{u.email}</div></td>
                  <td><b>{u.points.toLocaleString("vi-VN")}</b></td>
                  <td>{u.pointsTotalEarned.toLocaleString("vi-VN")}</td>
                  <td style={{ whiteSpace: "normal" }}>
                    <form action={adjustPointsAction} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input name="amount" type="number" min={1} max={1000000} placeholder="Số điểm" required style={{ width: 96, height: 34, border: "1px solid var(--aline)", borderRadius: 8, padding: "0 8px" }} />
                      <input name="note" placeholder="Lý do (không bắt buộc)" style={{ width: 170, height: 34, border: "1px solid var(--aline)", borderRadius: 8, padding: "0 8px" }} />
                      <button className="btn btn-dark btn-sm" type="submit" formAction={addPointsAction}>Cộng</button>
                      <button className="btn btn-outline btn-sm" type="submit" formAction={subtractPointsAction} style={{ color: "#B3261E" }}>Trừ</button>
                    </form>
                  </td>
                </tr>
              ))}
              {!users.length && <tr><td colSpan={4} className="muted">Không có khách nào khớp.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      )}

      {active === "history" && (
      <div className="admin-card">
        <h3 style={{ margin: "0 0 12px" }}>Biến động điểm gần nhất</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Thời gian</th><th>Khách</th><th>Loại</th><th>Điểm</th><th>Số dư sau</th><th>Ghi chú</th></tr></thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id}>
                  <td>{t.createdAt.toLocaleString("vi-VN")}</td>
                  <td>{t.user.email}</td>
                  <td>{KIND_LABEL[t.kind] ?? t.kind}</td>
                  <td style={{ color: t.delta >= 0 ? "#177245" : "#B3261E", fontWeight: 700 }}>{t.delta >= 0 ? "+" : ""}{t.delta.toLocaleString("vi-VN")}</td>
                  <td>{t.balanceAfter.toLocaleString("vi-VN")}</td>
                  <td style={{ whiteSpace: "normal" }}>{t.note ?? t.ref ?? ""}</td>
                </tr>
              ))}
              {!txns.length && <tr><td colSpan={6} className="muted">Chưa có biến động điểm nào.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
