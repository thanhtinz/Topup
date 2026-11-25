import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { telegramConfig, telegramPackages, tgSellCents, tgCostCents, TG_SLUG } from "@/lib/telegram";
import { getProviderBalance } from "@/lib/providers";
import { fmtUSD } from "@/lib/money";
import { Top, Msg } from "../ui";
import { saveTelegramConfigAction } from "../actions";
import { readSyncState } from "@/lib/sync";
import SyncButton from "../providers/SyncButton";

export const dynamic = "force-dynamic";

export default async function AdminTelegramPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const s = await getSettings();
  const cfg = await telegramConfig();
  const fzrBalance = await getProviderBalance("FZR").catch(() => "Không đọc được số dư");
  const syncedAt = s.telegram_synced_at ? new Date(s.telegram_synced_at) : null;
  const fzrSync = await readSyncState("FZR");
  const packs = await telegramPackages().catch(() => ({ stars: [], premium: [] }));
  const hub = await prisma.game.findUnique({ where: { slug: TG_SLUG }, select: { soldCount: true } });
  const exStar = 0.0163;
  const exPrem = 71.99;
  return (
    <div>
      <Top title="Telegram" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <h2>Cách tính giá</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Sản phẩm Telegram (card ghim thứ ba ở trang chủ + trang dịch vụ) bán qua nhà cung cấp FZR:
          tab <b>Sao</b> nạp Telegram Stars theo username, tab <b>Premium</b> tặng Telegram Premium theo số tháng.
          Giá bán = giá FZR × (1 + markup %) làm tròn lên cent, mỗi tab một markup riêng. Giá sao chốt TƯƠI theo
          báo giá FZR tại lúc khách đặt; gói Premium chốt lại plan tươi theo đúng số tháng. Bật/tắt hiển thị ở trang
          Quản lý module. Số dư FZR hiện tại: <b>{fzrBalance}</b> — hết số dư là đơn Telegram sẽ lỗi.
          Đã bán: <b>{(hub?.soldCount ?? 0).toLocaleString("vi-VN")} đơn</b> · Gói đang bán:{" "}
          <b>{packs.stars.length} gói Sao</b> (gồm gói số sao tuỳ chọn) + <b>{packs.premium.length} gói Premium</b>
          {syncedAt ? <> · đồng bộ gói gần nhất: <b>{syncedAt.toLocaleString("vi-VN")}</b></> : <> · <b>chưa đồng bộ gói lần nào</b></>}.
        </p>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 16 }}>
          <div>Markup Sao hiện tại: <b>{cfg.markupStars}%</b></div>
          <div>Markup Premium hiện tại: <b>{cfg.markupPremium}%</b></div>
          <div>
            Ví dụ 50 Sao (${(exStar * 50).toFixed(4)}): khách trả <b>{fmtUSD(tgSellCents(exStar * 50, cfg.markupStars))}</b>, vốn <b>{fmtUSD(tgCostCents(exStar * 50))}</b>
          </div>
          <div>
            Ví dụ Premium 12 tháng (${exPrem}): khách trả <b>{fmtUSD(tgSellCents(exPrem, cfg.markupPremium))}</b>, vốn <b>{fmtUSD(tgCostCents(exPrem))}</b>
          </div>
        </div>
        <form action={saveTelegramConfigAction}>
          <div className="field">
            <label>Markup Sao (%)</label>
            <input name="telegram_markup_stars" type="number" step="0.01" min="-50" max="100" defaultValue={s.telegram_markup_stars} required />
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Cộng trên giá mỗi sao.</p>
          </div>
          <div className="field">
            <label>Markup Premium (%)</label>
            <input name="telegram_markup_premium" type="number" step="0.01" min="-50" max="100" defaultValue={s.telegram_markup_premium} required />
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Cộng trên giá từng plan Premium.</p>
          </div>
          <button className="btn btn-primary" type="submit">Lưu cấu hình Telegram</button>
        </form>
      </div>
      <div className="admin-card">
        <h2>Đồng bộ gói</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Gói Sao + Premium tự đồng bộ kèm mỗi lượt đồng bộ nguồn FZR. Cần giá mới ngay thì bấm đồng bộ FZR —
          nút này có tiến trình trực tiếp và cũng làm mới toàn bộ catalog game của FZR.
        </p>
        <SyncButton code="FZR" initial={fzrSync} />
      </div>
    </div>
  );
}
