import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";
import { addItemAction, createSaleAction, deleteItemAction, deleteSaleAction, toggleSaleAction } from "./actions";

export const dynamic = "force-dynamic";

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function AdminFlashSales({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; sale?: string; game?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const sales = await prisma.flashSale.findMany({
    orderBy: { startsAt: "desc" },
    take: 20,
    include: { items: { include: { package: { select: { name: true, priceCents: true, game: { select: { name: true } } } } }, orderBy: { id: "asc" } } },
  });
  const saleId = sp.sale ? Number(sp.sale) : sales[0]?.id;
  const games = saleId ? await prisma.game.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [];
  const gameId = sp.game ? Number(sp.game) : games[0]?.id;
  const pkgs = gameId ? await prisma.package.findMany({ where: { gameId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, priceCents: true } }) : [];

  const phase = (s: (typeof sales)[number]) => (!s.active ? "Đã tắt" : now < s.startsAt ? "Sắp diễn ra" : now > s.endsAt ? "Đã kết thúc" : "ĐANG CHẠY");

  return (
    <div>
      <div className="admin-top-row"><h1>Flash Sale</h1></div>
      <p className="muted" style={{ marginBottom: 16, maxWidth: 760 }}>Đợt giảm giá theo khung giờ cho từng gói. Giá flash được kiểm chứng lại phía máy chủ khi khách mua; giới hạn suất được giữ chỗ nguyên tử lúc tạo đơn và trả lại khi đơn bị hoàn.</p>
      {sp.msg && <p className="msg-ok">{sp.msg}</p>}
      {sp.err && <p className="msg-err">{sp.err}</p>}

      <div className="admin-card">
        <h2>Tạo đợt Flash Sale mới</h2>
        <form action={createSaleAction} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 220, flex: "1 1 220px" }}><label>Tên đợt</label><input name="name" required placeholder="VD: Flash Sale cuối tuần" /></div>
          <div className="field" style={{ marginBottom: 0 }}><label>Bắt đầu</label><input name="startsAt" type="datetime-local" required defaultValue={toLocalInput(now)} /></div>
          <div className="field" style={{ marginBottom: 0 }}><label>Kết thúc</label><input name="endsAt" type="datetime-local" required defaultValue={toLocalInput(new Date(now.getTime() + 24 * 3600 * 1000))} /></div>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14, paddingBottom: 10 }}><input type="checkbox" name="active" value="1" defaultChecked /> Bật ngay</label>
          <button className="btn btn-accent" type="submit">Tạo đợt</button>
        </form>
      </div>

      {saleId ? (
        <div className="admin-card">
          <h2>Thêm gói vào đợt sale</h2>
          <form method="get" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 14 }}>
            <div className="field" style={{ marginBottom: 0, minWidth: 220 }}><label>Đợt sale</label>
              <select name="sale" defaultValue={saleId}>{sales.map((s) => <option key={s.id} value={s.id}>{s.name} ({phase(s)})</option>)}</select></div>
            <div className="field" style={{ marginBottom: 0, minWidth: 200 }}><label>Game</label>
              <select name="game" defaultValue={gameId}>{games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
            <button className="btn btn-outline" type="submit">Chọn</button>
          </form>
          <form action={addItemAction} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
            <input type="hidden" name="flashSaleId" value={saleId} />
            <div className="field" style={{ marginBottom: 0, minWidth: 260, flex: "1 1 260px" }}><label>Gói nạp</label>
              <select name="packageId" required>
                {pkgs.map((p) => <option key={p.id} value={p.id}>{p.name} — giá thường {fmtUSD(p.priceCents)}</option>)}
              </select></div>
            <div className="field" style={{ marginBottom: 0, width: 130 }}><label>Giá flash ($)</label><input name="salePrice" type="number" step="0.01" min="0.01" required /></div>
            <div className="field" style={{ marginBottom: 0, width: 170 }}><label>Giới hạn suất (trống = không giới hạn)</label><input name="stockLimit" type="number" min="1" /></div>
            <button className="btn btn-accent" type="submit">Thêm gói</button>
          </form>
        </div>
      ) : null}

      {sales.map((s) => (
        <div key={s.id} className="admin-card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
            <div>
              <strong style={{ fontSize: 16 }}>{s.name}</strong>
              <span className={`badge ${phase(s) === "ĐANG CHẠY" ? "red" : "gray"}`} style={{ marginLeft: 8 }}>{phase(s)}</span>
              <div className="muted">{s.startsAt.toLocaleString("vi-VN")} → {s.endsAt.toLocaleString("vi-VN")} · {s.items.length} gói</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <form action={toggleSaleAction} className="inline-form"><input type="hidden" name="id" value={s.id} /><input type="hidden" name="active" value={s.active ? "0" : "1"} /><button className="btn btn-outline btn-sm" type="submit">{s.active ? "Tắt" : "Bật"}</button></form>
              <form action={deleteSaleAction} className="inline-form"><input type="hidden" name="id" value={s.id} /><button className="btn btn-danger btn-sm" type="submit">Xoá đợt</button></form>
            </div>
          </div>
          {s.items.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Gói</th><th>Game</th><th>Giá thường</th><th>Giá flash</th><th>Đã bán / Giới hạn</th><th></th></tr></thead>
                <tbody>
                  {s.items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.package.name}</td>
                      <td>{it.package.game.name}</td>
                      <td>{fmtUSD(it.package.priceCents)}</td>
                      <td><b style={{ color: "#D92D20" }}>{fmtUSD(it.salePriceCents)}</b></td>
                      <td>{it.soldCount} / {it.stockLimit ?? "∞"}</td>
                      <td><form action={deleteItemAction} className="inline-form"><input type="hidden" name="id" value={it.id} /><button className="btn btn-ghost btn-sm" type="submit">Gỡ</button></form></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
      {sales.length === 0 && <p className="muted">Chưa có đợt Flash Sale nào — tạo đợt đầu tiên ở form trên.</p>}
    </div>
  );
}
