import { prisma } from "@/lib/db";
import { Top, Msg } from "../ui";
import { createDiscountAction, toggleDiscountAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminDiscounts({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const codes = await prisma.discountCode.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div>
      <Top title="Mã giảm giá" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <h2>Tạo mã mới</h2>
        <form action={createDiscountAction} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field"><label>Mã</label><input name="code" required placeholder="WELCOME10" /></div>
          <div className="field"><label>Giảm (%)</label><input name="percent" type="number" min={1} max={90} required /></div>
          <div className="field"><label>Tổng lượt dùng (0 = không giới hạn)</label><input name="maxUses" type="number" min={0} defaultValue={0} /></div>
          <button className="btn btn-primary" type="submit">Tạo mã</button>
        </form>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Mã</th><th>Giảm</th><th>Đã dùng</th><th>Giới hạn</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id}>
                <td><b>{c.code}</b></td><td>{c.percent}%</td><td>{c.usedCount}</td><td>{c.maxUses ?? "∞"}</td>
                <td><span className={`badge ${c.active ? "green" : "gray"}`}>{c.active ? "Đang chạy" : "Đã tắt"}</span></td>
                <td>
                  <form action={toggleDiscountAction} className="inline-form">
                    <input type="hidden" name="id" value={c.id} />
                    <button className="btn btn-ghost btn-sm" type="submit">{c.active ? "Tắt" : "Bật"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
