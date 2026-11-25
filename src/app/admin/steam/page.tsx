import { getSettings } from "@/lib/settings";
import { steamConfig } from "@/lib/steam";
import { getProviderBalance } from "@/lib/providers";
import { fmtUSD } from "@/lib/money";
import { Top, Msg } from "../ui";
import { saveSteamConfigAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminSteamPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const s = await getSettings();
  const cfg = await steamConfig();
  const fzrBalance = await getProviderBalance("FZR").catch(() => "Không đọc được số dư");
  return (
    <div>
      <Top title="Steam Top-Up" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <h2>Cách tính giá</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Đơn nạp Steam chạy qua nhà cung cấp FZR (dịch vụ Steam Top-Up, khách nhập số tiền USD tự do).
          Giá phải tính cả discount của GÓI PLAN FZR: cơ số mỗi $1 = $1 × (1 − discount gói plan %) — Bronze
          2.5% · Silver 3% · Gold 3.55% · volume lớn tới 5%, FZR không trả % này qua API nên phải điền tay theo
          gói plan của tài khoản. Giá vốn mỗi $1 = cơ số đó. Còn GIÁ BÁN thì điền thẳng giá cho $1 ở ô dưới — không tính markup.
          Bật/tắt hiển thị ở trang Quản lý module. Số dư FZR hiện tại: <b>{fzrBalance}</b> — hết số dư là đơn Steam sẽ lỗi.
        </p>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 16 }}>
          <div>Giá bán hiện tại mỗi $1: <b>{fmtUSD(cfg.unitPriceCents)}</b></div>
          <div>Giá vốn hiện tại mỗi $1: <b>{fmtUSD(cfg.unitCostCents)}</b></div>
          <div>Ví dụ nạp $5: khách trả <b>{fmtUSD(Math.ceil((cfg.unitPriceCents * 500) / 100))}</b>, nhận <b>{(5 * cfg.receiveRateVnd).toLocaleString("vi-VN").replace(/,/g, ".")} ₫</b> vào ví Steam</div>
        </div>
        <form action={saveSteamConfigAction}>
          <div className="field">
            <label>Giá bán cho $1 (USD)</label>
            <input name="steam_unit_price" type="number" step="0.01" min="0.01" max="1000" defaultValue={(cfg.unitPriceCents / 100).toFixed(2)} required />
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Điền thẳng giá khách trả cho mỗi $1 nạp vào ví Steam, ví dụ 0.99. Tổng khách trả = giá này × số tiền nạp.</p>
          </div>
          <div className="field">
            <label>Discount gói plan FZR (%)</label>
            <input name="steam_discount_percent" type="number" step="0.01" min="0" max="99" defaultValue={s.steam_discount_percent} required />
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Chiết khấu FZR trừ trên mệnh giá theo gói plan của tài khoản (Bronze 2.5 · Silver 3 · Gold 3.55 · volume tới 5). Chỉ dùng tính GIÁ VỐN: vốn mỗi $1 = $1 × (1 − %). Điền đúng gói plan của tài khoản FZR đang dùng.</p>
          </div>
          <div className="field">
            <label>Số VNĐ khách nhận vào ví Steam cho mỗi $1</label>
            <input name="steam_receive_rate_vnd" type="number" step="1" min="0" max="1000000" defaultValue={s.steam_receive_rate_vnd} required />
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Hiện ở dòng “Sẽ nhận” trên trang nạp. Ví dụ 26000 → nạp $5 nhận 130.000 ₫.</p>
          </div>
          <div className="field">
            <label>Số tiền nạp tối thiểu mỗi lần (USD)</label>
            <input name="steam_min_usd" type="number" step="0.01" min="0.1" max="1000" defaultValue={s.steam_min_usd} required />
          </div>
          <div className="field">
            <label>Số tiền nạp tối đa mỗi lần (USD)</label>
            <input name="steam_max_usd" type="number" step="1" min="1" max="100000" defaultValue={s.steam_max_usd} required />
          </div>
          <button className="btn btn-primary" type="submit">Lưu cấu hình Steam</button>
        </form>
      </div>
    </div>
  );
}
