import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { saveStatusAction } from "./actions";

export const dynamic = "force-dynamic";

const OVERRIDES = [
  { key: "website", label: "Website & đặt hàng" },
  { key: "api", label: "API đấu nối cho khách hàng (tín hiệu nội bộ: độ tươi đồng bộ nguồn)" },
  { key: "payments", label: "Nạp ví & thanh toán" },
];

export default async function AdminStatus({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  return (
    <div>
      <div className="admin-top-row"><h1>Trạng thái hệ thống</h1></div>
      <p className="muted" style={{ marginBottom: 16, maxWidth: 760 }}>
        Trang công khai <Link href="/status">/status</Link> tự tính trạng thái từ tín hiệu thật (lần đồng bộ gần nhất, cổng nạp đã cấu hình).
        Chỉ ghi đè thủ công khi cần thông báo bảo trì/sự cố — nhớ đặt lại "Tự động" sau khi xử lý xong.
      </p>
      {sp.msg && <p className="msg-ok">{sp.msg}</p>}
      {sp.err && <p className="msg-err">{sp.err}</p>}

      <form action={saveStatusAction}>
        <div className="admin-card">
          <h2>Ghi đè trạng thái từng thành phần</h2>
          {OVERRIDES.map((o) => (
            <div key={o.key} className="field" style={{ maxWidth: 420 }}>
              <label>{o.label}</label>
              <select name={`override_${o.key}`} defaultValue={s[`status_override_${o.key}`] ?? "auto"}>
                <option value="auto">Tự động (theo tín hiệu thật)</option>
                <option value="operational">Hoạt động bình thường</option>
                <option value="degraded">Chậm / không ổn định</option>
                <option value="down">Đang gián đoạn</option>
              </select>
            </div>
          ))}
        </div>

        <div className="admin-card">
          <h2>Thông báo sự cố / bảo trì</h2>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14, marginBottom: 12 }}>
            <input type="checkbox" name="incident_on" value="1" defaultChecked={s.status_incident_on === "1"} /> Hiện thông báo trên trang /status
          </label>
          <div className="field"><label>Tiêu đề thông báo</label><input name="incident_title" defaultValue={s.status_incident_title ?? ""} placeholder="VD: Bảo trì cổng nạp QR ngân hàng" maxLength={160} /></div>
          <div className="field"><label>Nội dung</label><textarea name="incident_body" rows={3} defaultValue={s.status_incident_body ?? ""} placeholder="Thời gian dự kiến, phạm vi ảnh hưởng, hướng dẫn cho khách..." maxLength={600} /></div>
        </div>

        <button className="btn btn-accent" type="submit">Lưu cấu hình trạng thái</button>
      </form>
    </div>
  );
}
