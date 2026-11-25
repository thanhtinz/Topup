import { prisma } from "@/lib/db";
import { Top, Msg } from "../../../ui";
import { deleteLevelAction, saveLevelAction } from "../actions";
import { fmtUSD } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminCreatorLevels({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const levels = await prisma.creatorLevel.findMany({ orderBy: { sort: "asc" }, include: { _count: { select: { creators: true } } } });
  return (
    <div>
      <Top title="Affiliate — Cấp độ" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <p className="muted" style={{ marginBottom: 12 }}>Affiliate tự nâng cấp khi doanh thu 30 ngày đạt ngưỡng của cấp cao hơn. Tỉ lệ riêng từng Affiliate (nếu đặt) luôn thắng tỉ lệ cấp.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tên cấp</th><th>Hoa hồng</th><th>Doanh thu 30 ngày tối thiểu</th><th>Màu</th><th>Thứ tự</th><th>Affiliate</th><th></th></tr></thead>
            <tbody>
              {levels.map((l) => (
                <tr key={l.id}>
                  <td colSpan={7}>
                    <form action={saveLevelAction} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <input type="hidden" name="id" value={l.id} />
                      <input name="name" defaultValue={l.name} style={{ width: 130 }} />
                      <input name="rate" type="number" step="0.01" min="0" max="100" defaultValue={(l.rateBps / 100).toFixed(2)} style={{ width: 90 }} title="Hoa hồng %" />
                      <input name="minRevenue" type="number" step="0.01" min="0" defaultValue={(l.minRevenue30dCents / 100).toFixed(2)} style={{ width: 120 }} title="Doanh thu tối thiểu USD" />
                      <input name="color" type="color" defaultValue={l.color} style={{ width: 52 }} />
                      <input name="sort" type="number" defaultValue={l.sort} style={{ width: 64 }} />
                      <span className="muted">{l._count.creators} creator · ngưỡng {fmtUSD(l.minRevenue30dCents)}</span>
                      <button className="btn btn-dark btn-sm" type="submit">Lưu</button>
                      <button className="btn btn-ghost btn-sm" formAction={deleteLevelAction} type="submit">Xoá</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 style={{ marginTop: 18 }}>Thêm cấp mới</h3>
        <form action={saveLevelAction} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input name="name" placeholder="Tên cấp" required style={{ width: 130 }} />
          <input name="rate" type="number" step="0.01" min="0" max="100" placeholder="%" required style={{ width: 90 }} />
          <input name="minRevenue" type="number" step="0.01" min="0" placeholder="Doanh thu $" style={{ width: 120 }} />
          <input name="color" type="color" defaultValue="#0B63E5" style={{ width: 52 }} />
          <input name="sort" type="number" placeholder="Thứ tự" style={{ width: 64 }} />
          <button className="btn btn-dark btn-sm" type="submit">Thêm cấp</button>
        </form>
      </div>
    </div>
  );
}
