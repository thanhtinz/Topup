import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Top, Msg } from "../../../ui";
import { saveCreatorSettingsAction } from "../actions";
import { creatorConfig } from "@/lib/creator";
import { fmtUSD } from "@/lib/money";

export const dynamic = "force-dynamic";

async function groupMargins() {
  const s = await getSettings();
  const rows = await prisma.$queryRaw<Array<{ provider: string; margin: number }>>`
    SELECT provider, AVG(("priceCents" - "costCents") * 100.0 / NULLIF("priceCents", 0)) AS margin
    FROM "Package" WHERE active AND "costCents" > 0 GROUP BY provider`;
  const byProvider = new Map(rows.map((r) => [r.provider, Number(r.margin)]));
  const discount = parseFloat(s.steam_discount_percent || "0") || 0;
  const unitSell = parseInt(s.steam_unit_price_cents || "0", 10) || Math.round(100 * (1 + (parseFloat(s.steam_markup_percent || "0") || 0) / 100));
  const steamCost = 100 * (1 - discount / 100);
  const steamMargin = unitSell > 0 ? ((unitSell - steamCost) / unitSell) * 100 : 0;
  const tgMarkup = parseFloat(s.telegram_markup_stars || "0") || 0;
  const tgMargin = (tgMarkup / (100 + tgMarkup)) * 100;
  const giftSell = 1 + (parseFloat(s.steamgift_markup_percent || "0") || 0) / 100;
  const giftMargin = ((giftSell - (1 - discount / 100)) / giftSell) * 100;
  return {
    STEAM_TOPUP: steamMargin,
    TELEGRAM: tgMargin,
    STEAM_GIFT: giftMargin,
    TOPUP_FZR: byProvider.get("FZR") ?? 0,
    TOPUP_ERIS: byProvider.get("ERIS") ?? 0,
  } as Record<string, number>;
}

export default async function AdminCreatorSettings({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const cfg = await creatorConfig();
  const margins = await groupMargins();
  const rateVal = (bps: number | null) => (bps === null ? "" : (bps / 100).toFixed(2).replace(/\.?0+$/, ""));
  const groups: Array<[string, string, number | null]> = [
    ["rateSteamTopup", "Steam Top-Up", cfg.groupRates.STEAM_TOPUP],
    ["rateTelegram", "Telegram", cfg.groupRates.TELEGRAM],
    ["rateSteamGift", "Steam Gift", cfg.groupRates.STEAM_GIFT],
    ["rateTopupFzr", "Nạp game FZR", cfg.groupRates.TOPUP_FZR],
    ["rateTopupEris", "Nạp game ERIS", cfg.groupRates.TOPUP_ERIS],
  ];
  const groupKeys = ["STEAM_TOPUP", "TELEGRAM", "STEAM_GIFT", "TOPUP_FZR", "TOPUP_ERIS"];
  return (
    <div>
      <Top title="Affiliate — Cài đặt" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <p className="muted" style={{ marginBottom: 12 }}>
          Bật/tắt toàn bộ chương trình ở Quản lý module (mục Creator & Đối tác). Tỉ lệ hoa hồng theo cấp ở tab Cấp độ; tỉ lệ riêng từng Affiliate ở trang chi tiết Affiliate.
          Hiện tại: cửa sổ ghi nhận {cfg.attributionDays} ngày · giữ hoa hồng {cfg.holdDays} ngày · rút tối thiểu {fmtUSD(cfg.minWithdrawCents)} · tối đa {cfg.maxLinks} link/Affiliate · trần tổng hoa hồng {(cfg.maxRateBps / 100).toFixed(2).replace(/\.?0+$/, "")}%.
        </p>
        <form action={saveCreatorSettingsAction}>
          <div className="form-grid">
            <div className="field"><label>Cửa sổ ghi nhận (ngày)</label><input name="attributionDays" type="number" min="1" max="365" defaultValue={cfg.attributionDays} /></div>
            <div className="field"><label>Thời gian giữ hoa hồng (ngày)</label><input name="holdDays" type="number" min="0" max="90" defaultValue={cfg.holdDays} /></div>
            <div className="field"><label>Rút tối thiểu (USD)</label><input name="minWithdraw" type="number" step="0.01" min="0" defaultValue={(cfg.minWithdrawCents / 100).toFixed(2)} /></div>
            <div className="field"><label>Số link tối đa mỗi Affiliate</label><input name="maxLinks" type="number" min="1" max="200" defaultValue={cfg.maxLinks} /></div>
            <div className="field"><label>Phiên bản điều khoản</label><input name="termsVersion" defaultValue={cfg.termsVersion} /></div>
            <div className="field">
              <label>Bảng xếp hạng công khai</label>
              <select name="rankingPublic" defaultValue={cfg.rankingPublic ? "1" : "0"}>
                <option value="0">Ẩn</option>
                <option value="1">Hiện ở trang chương trình</option>
              </select>
            </div>
            <div className="field"><label>Trần tổng hoa hồng % (cấp + bonus)</label><input name="maxRate" type="number" step="0.01" min="0" max="100" defaultValue={(cfg.maxRateBps / 100).toFixed(2)} /></div>
          </div>

          <h3 style={{ marginTop: 18 }}>Tỉ lệ riêng theo nhóm biên mỏng (% — để trống = theo cấp)</h3>
          <p className="muted" style={{ marginBottom: 10 }}>
            Nhóm có tỉ lệ riêng thì áp tỉ lệ đó là mức cuối cho mọi Creator (không cộng bonus campaign, không theo cấp) để không vượt biên lãi của nhóm.
            Biên lãi đo được hiện tại hiển thị cạnh từng nhóm — nhóm nào biên thấp hơn cấp cao nhất nên tách riêng.
          </p>
          <div className="form-grid">
            {groups.map(([name, label, val], i) => (
              <div className="field" key={name}>
                <label>{label} — biên ~{margins[groupKeys[i]].toFixed(1)}%</label>
                <input name={name} type="number" step="0.01" min="0" max="100" defaultValue={rateVal(val)} placeholder="Theo cấp" />
              </div>
            ))}
          </div>
          <div className="form-actions"><button className="btn btn-dark" type="submit">Lưu cài đặt</button></div>
        </form>
      </div>
    </div>
  );
}
