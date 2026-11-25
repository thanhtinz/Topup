import { getSettings } from "@/lib/settings";
import { giftConfig, giftSellCents, giftCostCents } from "@/lib/steamgift";
import { getProviderBalance } from "@/lib/providers";
import { fmtUSD } from "@/lib/money";
import { Top, Msg } from "../ui";
import { saveSteamGiftConfigAction } from "../actions";
import { readSyncState } from "@/lib/sync";
import SyncButton from "../providers/SyncButton";

export const dynamic = "force-dynamic";

export default async function AdminSteamGiftPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const s = await getSettings();
  const cfg = await giftConfig();
  const fzrBalance = await getProviderBalance("FZR").catch(() => "Không đọc được số dư");
  const syncedAt = s.steamgift_synced_at ? new Date(s.steamgift_synced_at) : null;
  const giftSync = await readSyncState("STEAMGIFT");
  const exUsd = 14.1906;
  return (
    <div>
      <Top title="Steam Gift" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <h2>Cách tính giá</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Đơn tặng game Steam chạy qua nhà cung cấp FZR (nhóm Steam Gifts): khách chọn game, phiên bản và
          khu vực cửa hàng; giá lấy TƯƠI từ offer của FZR tại thời điểm đặt (máy chủ chốt lại, không tin giá
          phía khách). Giá bán = giá offer × (1 + markup %). Giá vốn = giá offer × (1 − discount gói plan %) —
          discount dùng chung ô ở trang Steam Top-Up vì cùng một tài khoản FZR. Bật/tắt hiển thị ở trang
          Quản lý module. Số dư FZR hiện tại: <b>{fzrBalance}</b> — hết số dư là đơn Steam Gift sẽ lỗi.
        </p>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 16 }}>
          <div>Markup hiện tại: <b>{cfg.markupPct}%</b></div>
          <div>Discount gói plan (dùng chung Steam Top-Up): <b>{cfg.discountPct}%</b></div>
          <div>
            Ví dụ CS2 Prime (vùng UA, offer ${exUsd}): khách trả <b>{fmtUSD(giftSellCents(exUsd, cfg.markupPct))}</b>,
            vốn <b>{fmtUSD(giftCostCents(exUsd, cfg.discountPct))}</b>
          </div>
        </div>
        <form action={saveSteamGiftConfigAction}>
          <div className="field">
            <label>Markup (%)</label>
            <input name="steamgift_markup_percent" type="number" step="0.01" min="-50" max="100" defaultValue={s.steamgift_markup_percent} required />
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Cộng trên giá offer của FZR cho mọi game/vùng. Ví dụ offer $14.19 với markup 2% → khách trả $14.48 (làm tròn lên cent).</p>
          </div>
          <button className="btn btn-primary" type="submit">Lưu cấu hình Steam Gift</button>
        </form>
      </div>
      <div className="admin-card">
        <h2>Danh mục game</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Danh sách game lấy từ FZR (chỉ tên + App ID; phiên bản/vùng/giá luôn lấy tươi khi khách mở trang).
          FZR giới hạn lấy danh sách tối đa 1 lần mỗi 3 phút và làm mới danh mục mỗi 3 giờ — chỉ cần bấm đồng bộ
          thỉnh thoảng. Hiện có: <b>{(parseInt(s.steamgift_count, 10) || 0).toLocaleString("vi-VN")} game</b>
          {syncedAt ? <> · đồng bộ gần nhất: <b>{syncedAt.toLocaleString("vi-VN")}</b></> : <> · <b>chưa đồng bộ lần nào</b> — trang khách sẽ trống tới khi đồng bộ</>}.
        </p>
        <SyncButton code="STEAMGIFT" initial={giftSync} />
      </div>
    </div>
  );
}
