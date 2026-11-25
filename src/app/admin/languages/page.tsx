import { getSettings } from "@/lib/settings";
import { Top, Msg } from "../ui";
import { saveLanguagesAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLanguages({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const s = await getSettings();
  return (
    <div>
      <Top title="Ngôn ngữ" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <h2>Ngôn ngữ phía khách</h2>
        <p className="muted" style={{ marginBottom: 14 }}>Khách tự chọn ngôn ngữ ở đầu trang. Tiếng Việt luôn bật; tiếng Anh bật/tắt và chọn mặc định cho khách mới tại đây. Admin luôn hiển thị tiếng Việt.</p>
        <form action={saveLanguagesAction} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          <div className="field">
            <label>Tiếng Anh (English)</label>
            <select name="lang_en_enabled" defaultValue={s.lang_en_enabled !== "0" ? "1" : "0"}>
              <option value="1">Bật</option>
              <option value="0">Tắt</option>
            </select>
          </div>
          <div className="field">
            <label>Ngôn ngữ mặc định cho khách mới</label>
            <select name="lang_default" defaultValue={s.lang_default === "en" ? "en" : "vi"}>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn btn-primary" type="submit">Lưu ngôn ngữ</button>
          </div>
        </form>
      </div>
      <div className="admin-card">
        <h2>Ngôn ngữ đang có</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Ngôn ngữ</th><th>Mã</th><th>Trạng thái</th></tr></thead>
            <tbody>
              <tr><td><b>Tiếng Việt</b></td><td>vi</td><td><span className="badge green">Đang bật</span></td></tr>
              <tr><td><b>English</b></td><td>en</td><td><span className={`badge ${s.lang_en_enabled !== "0" ? "green" : "gray"}`}>{s.lang_en_enabled !== "0" ? "Đang bật" : "Đã tắt"}</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
