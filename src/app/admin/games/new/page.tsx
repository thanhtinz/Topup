import Link from "next/link";
import { Top, Msg } from "../../ui";
import { createGameAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AdminGameNew({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  return (
    <div>
      <Top title="Thêm sản phẩm">
        <Link className="btn btn-ghost btn-sm" href="/admin/games">← Quản lý game</Link>
      </Top>
      <Msg msg={msg} err={err} />
      <div className="admin-card" style={{ maxWidth: 760 }}>
        <h2>Game mới</h2>
        <form action={createGameAction} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field"><label>Tên game</label><input name="name" required placeholder="Free Fire" /></div>
          <div className="field"><label>Slug (đường dẫn)</label><input name="slug" required placeholder="free-fire" /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label>Ảnh bìa (URL hoặc /covers/...)</label><input name="cover" required placeholder="/covers/freefire.png" /></div>
          <div className="field"><label>Thể loại</label><input name="genre" defaultValue="" placeholder="Ví dụ: Gacha, Nhập vai, FPS — để trống nếu chưa phân loại" /></div>
          <div className="field"><label>Khu vực (cách nhau dấu phẩy)</label><input name="regions" defaultValue="Global" /></div>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
            <button className="btn btn-accent" type="submit">Thêm sản phẩm</button>
            <span className="muted">Thêm xong vào trang Gói của game để thêm gói nạp.</span>
          </div>
        </form>
      </div>
    </div>
  );
}
