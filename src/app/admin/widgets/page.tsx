import { getSettings } from "@/lib/settings";
import { listContactWidgets } from "@/lib/contact";
import { Top, Msg } from "../ui";
import { saveSettingsAction, saveContactWidgetAction, toggleContactWidgetAction, deleteContactWidgetAction } from "../actions";

export const dynamic = "force-dynamic";

const inputStyle: React.CSSProperties = { width: "100%", height: 40, border: "1px solid var(--aline)", borderRadius: 10, padding: "0 12px", fontFamily: "inherit", fontSize: 14, boxSizing: "border-box", background: "#fff" };

function WidgetForm({ w }: { w?: { id: number; name: string; link: string; image: string | null; sort: number } }) {
  return (
    <form action={saveContactWidgetAction}>
      {w ? <input type="hidden" name="id" value={w.id} /> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
        <div className="field"><label>Tên kênh (Zalo, Telegram, Facebook, Hotline…)</label><input name="name" required defaultValue={w?.name ?? ""} placeholder="Zalo" style={inputStyle} /></div>
        <div className="field"><label>Liên kết / số (tự chuẩn hoá theo tên kênh)</label><input name="link" required defaultValue={w?.link ?? ""} placeholder="09xx xxx xxx hoặc https://…" style={inputStyle} /></div>
        <div className="field"><label>Thứ tự hiện</label><input name="sort" type="number" defaultValue={w?.sort ?? 0} style={inputStyle} /></div>
        <div className="field"><label>Ảnh kênh (URL — hoặc tải file bên dưới)</label><input name="imageUrl" defaultValue={w?.image ?? ""} placeholder="https://… (để trống = dùng ô màu + ký hiệu)" style={inputStyle} /></div>
        <div className="field"><label>Tải ảnh lên</label><input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" style={{ ...inputStyle, padding: "8px 12px" }} /></div>
      </div>
      <div className="form-actions">
        <button className="btn btn-dark" type="submit">{w ? "Lưu kênh" : "Thêm kênh"}</button>
      </div>
    </form>
  );
}

export default async function AdminWidgets({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const s = await getSettings();
  const items = await listContactWidgets();
  return (
    <div>
      <Top title="Widget liên hệ" />
      <Msg msg={msg} err={err} />

      <div className="admin-card">
        <form action={saveSettingsAction}>
          <input type="hidden" name="_path" value="/admin/widgets" />
          <input type="hidden" name="_checkboxes" value="support_widget_enabled" />
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", border: "1px solid var(--aline)", borderRadius: 12, background: "#FAFBFE" }}>
            <input type="checkbox" name="support_widget_enabled" value="1" defaultChecked={s.support_widget_enabled === "1"} style={{ width: 20, height: 20, accentColor: "var(--aaccent)" }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>Hiện widget liên hệ nổi</div>
              <div className="muted" style={{ fontSize: 13 }}>Các bong bóng kênh liên hệ ở góc phải dưới trang khách. Tắt thì ẩn toàn bộ; chưa có kênh nào đang bật thì cũng không hiện gì.</div>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-dark" type="submit">Lưu</button>
          </div>
        </form>
      </div>

      <div className="admin-card">
        <h2>Thêm kênh liên hệ</h2>
        <p className="muted" style={{ marginBottom: 12 }}>Mỗi kênh là một bong bóng riêng phía khách và một dòng trong cột Liên hệ ở chân trang. Link được tự chuẩn hoá: kênh Zalo điền số điện thoại sẽ thành zalo.me, Telegram điền @tên sẽ thành t.me, Hotline thành nút gọi.</p>
        <WidgetForm />
      </div>

      <div className="admin-card">
        <h2>Danh sách kênh ({items.length})</h2>
        {!items.length && <p className="muted">Chưa có kênh nào. Thêm kênh đầu tiên ở thẻ phía trên — phía khách sẽ không hiện widget nào cho tới khi có kênh đang bật.</p>}
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((w) => (
            <div key={w.id} style={{ border: "1px solid var(--aline)", borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                {w.image ? (
                  <img src={w.image} alt={w.name} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", background: "#fff", border: "1px solid var(--aline)" }} />
                ) : (
                  <span style={{ width: 48, height: 48, borderRadius: "50%", background: w.bg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 17 }}>{w.name.trim().charAt(0).toUpperCase() || "?"}</span>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b>{w.name}</b> <span className={`badge ${w.active ? "green" : "gray"}`}>{w.active ? "Đang hiện" : "Đã ẩn"}</span>
                  <div className="muted" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.link} · thứ tự {w.sort}</div>
                </div>
                <form action={toggleContactWidgetAction}>
                  <input type="hidden" name="id" value={w.id} />
                  <button className="btn btn-outline btn-sm" type="submit">{w.active ? "Ẩn" : "Hiện"}</button>
                </form>
                <form action={deleteContactWidgetAction}>
                  <input type="hidden" name="id" value={w.id} />
                  <button className="btn btn-outline btn-sm" type="submit" style={{ color: "#B3261E" }}>Xoá</button>
                </form>
              </div>
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Sửa kênh</summary>
                <div style={{ marginTop: 10 }}><WidgetForm w={w} /></div>
              </details>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
