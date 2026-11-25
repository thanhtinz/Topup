import { getSettings } from "@/lib/settings";
import { Top, Msg } from "../ui";
import { saveSettingsAction } from "../actions";

export const dynamic = "force-dynamic";

const MODULES = [
  ["module_banner", "Banner trang chủ", "Dải banner game bán chạy ở đầu trang chủ — tự cập nhật theo doanh số, kèm khoảng giá gói."],
  ["module_discount", "Mã giảm giá", "Cho phép khách áp mã giảm khi mua gói."],
  ["module_steam", "Steam Top-Up", "Card nạp Steam ghim đầu trang chủ + trang dịch vụ, trang nạp riêng theo số tiền tự do — giá và giới hạn chỉnh ở trang Steam Top-Up."],
  ["module_steamgift", "Steam Gift", "Card tặng game Steam ghim ngay sau Steam Top-Up, trang chọn game + phiên bản + khu vực lấy giá thật từ FZR — markup và đồng bộ danh mục ở trang Steam Gift."],
  ["module_telegram", "Telegram", "Card Telegram ghim ngay sau Steam Gift, trang bán Sao + Premium qua FZR chia 2 tab — markup riêng từng tab ở trang Telegram."],
  ["module_creator", "Partnership & Affiliate", "Hệ thống hợp tác Partnership; module Affiliate: link giới thiệu, hoa hồng theo cấp, rút tiền (quản lý ở Admin → Partnership → Affiliate)."],
  ["support_widget_enabled", "Widget liên hệ nổi", "Các bong bóng kênh liên hệ (Zalo / Telegram / Facebook / Hotline…) ở góc trang — danh sách kênh quản lý ở trang Widget liên hệ."],
] as const;

export default async function AdminModules({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const s = await getSettings();
  return (
    <div>
      <Top title="Quản lý module" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <h2>Module chức năng</h2>
        <p className="muted" style={{ marginBottom: 12 }}>Trang này chỉ bật/tắt. Cấu hình của module nào nằm ở nhà riêng của module đó. Tắt là module biến mất phía khách và bị chặn ở máy chủ.</p>
        <form action={saveSettingsAction}>
          <input type="hidden" name="_path" value="/admin/modules" />
          <input type="hidden" name="_checkboxes" value={MODULES.map(([k]) => k).join(",")} />
          {MODULES.map(([k, label, desc]) => (
            <div className="field" key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" name={k} value="1" defaultChecked={s[k] === "1"} style={{ width: 18, height: 18 }} />
              <label style={{ margin: 0 }}><b>{label}</b> — <span className="muted">{desc}</span></label>
            </div>
          ))}
          <button className="btn btn-primary" type="submit">Lưu module</button>
        </form>
      </div>
    </div>
  );
}
