"use client";
import { useMemo, useState } from "react";
import { buyTelegramAction } from "@/app/actions";
import { fmtMoney, type Cur } from "@/lib/moneyfmt";
import type { TelegramPackageView } from "@/lib/telegram";

function Section({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <section className="sec-card">
      <div className="sec-head">
        <span className="sec-num">{num}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

const L = {
  vi: {
    tab_stars: "Sao Telegram",
    tab_premium: "Telegram Premium",
    s1: "Chọn loại",
    s2: "Chọn gói",
    s3: "Thông tin nhận",
    s4: "Số lượng & thanh toán",
    username: "Tên người dùng Telegram",
    username_ph: "@username của tài khoản nhận",
    username_note: "Chỉ cần username, không cần mật khẩu. Kiểm tra kỹ — gửi nhầm username sẽ nạp vào tài khoản của người khác.",
    selected: "Gói đã chọn",
    qty_packs: "Số lượng gói",
    qty_gifts: "Số lượng",
    unit_price: "Đơn giá",
    total_wallet: "Tổng trừ ví",
    balance: "Số dư ví",
    buy_now: "Mua ngay",
    login_to_buy: "Đăng nhập để mua",
    empty: "Chưa có gói đang bán — quay lại sau ít phút.",
    stars_unit: "Sao",
    months: "tháng",
    note: "Giao tự động sau khi thanh toán, thường trong vòng một phút. Đơn lỗi dứt khoát sẽ được xử lý theo chính sách hoàn tiền.",
  },
  en: {
    tab_stars: "Telegram Stars",
    tab_premium: "Telegram Premium",
    s1: "Choose type",
    s2: "Choose package",
    s3: "Recipient info",
    s4: "Quantity & payment",
    username: "Telegram username",
    username_ph: "@username of the receiving account",
    username_note: "Username only, no password needed. Double-check it — a wrong username sends it to someone else's account.",
    selected: "Selected package",
    qty_packs: "Number of packs",
    qty_gifts: "Quantity",
    unit_price: "Unit price",
    total_wallet: "Total from wallet",
    balance: "Wallet balance",
    buy_now: "Buy now",
    login_to_buy: "Log in to buy",
    empty: "No packages on sale right now — check back in a few minutes.",
    stars_unit: "Stars",
    months: "months",
    note: "Delivered automatically after payment, usually within a minute. Definitively failed orders are handled under the refund policy.",
  },
} as const;

export default function Telegram({
  stars,
  premium,
  loggedIn,
  balanceCents,
  cur,
  lang,
}: {
  stars: TelegramPackageView[];
  premium: TelegramPackageView[];
  loggedIn: boolean;
  balanceCents: number;
  cur: Cur;
  lang: string;
}) {
  const t = lang === "en" ? L.en : L.vi;
  const [tab, setTab] = useState<"stars" | "premium">(stars.length ? "stars" : "premium");
  const shown = tab === "stars" ? stars : premium;
  const [pkgId, setPkgId] = useState<number>(0);
  const activePkg = shown.find((p) => p.id === pkgId) ?? shown[0];
  const [qty, setQty] = useState(1);
  const maxQty = tab === "premium" ? 5 : 10;
  const qtySafe = Math.min(maxQty, Math.max(1, qty || 1));

  const totalCents = useMemo(() => {
    if (!activePkg) return 0;
    return activePkg.priceCents * qtySafe;
  }, [activePkg, qtySafe]);

  return (
    <form action={buyTelegramAction} className="buy-layout">
      <input type="hidden" name="kind" value={tab} />
      <input type="hidden" name="itemKey" value={activePkg?.itemKey ?? ""} />
      <div>
        <Section num={1} title={t.s1}>
          <div className="pill-row tabs-row">
            <button type="button" className="pill" aria-pressed={tab === "stars"} onClick={() => { setTab("stars"); setQty(1); }} disabled={!stars.length}>{t.tab_stars} ({stars.length})</button>
            <button type="button" className="pill" aria-pressed={tab === "premium"} onClick={() => { setTab("premium"); setQty(1); }} disabled={!premium.length}>{t.tab_premium} ({premium.length})</button>
          </div>
        </Section>

        <Section num={2} title={t.s2}>
          <div className="tg-list">
            {shown.map((p) => {
              const selected = activePkg?.id === p.id;
              return (
                <button type="button" key={p.id} className="tg-row" aria-pressed={selected} onClick={() => { setPkgId(p.id); setQty(1); }}>
                  <span className="tg-check" aria-hidden>
                    {selected && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    )}
                  </span>
                  <span className="tg-row-name">{p.name}</span>
                  <span className="tg-row-price">{fmtMoney(p.priceCents, cur, lang)}</span>
                </button>
              );
            })}
          </div>
          {!shown.length && <p className="muted">{t.empty}</p>}
        </Section>

        <Section num={3} title={t.s3}>
          <div className="field">
            <label htmlFor="tg_username">{t.username} *</label>
            <input id="tg_username" name="username" required placeholder={t.username_ph} autoComplete="off" />
          </div>
          <p className="muted" style={{ marginTop: 6 }}>{t.username_note}</p>
        </Section>
      </div>

      <aside className="summary-card">
        <div className="sec-head">
          <span className="sec-num">4</span>
          <h2>{t.s4}</h2>
        </div>
        <div className="sum-row"><span className="muted">{t.selected}</span><b style={{ textAlign: "right" }}>{activePkg ? activePkg.name : "—"}</b></div>
        <div className="sum-row"><span className="muted">{t.unit_price}</span><span>{activePkg ? fmtMoney(activePkg.priceCents, cur, lang) : "—"}</span></div>
        <div style={{ margin: "12px 0" }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{tab === "premium" ? t.qty_gifts : t.qty_packs}</label>
          <div className="qty-row">
            <button type="button" className="qty-btn" onClick={() => setQty(Math.max(1, qtySafe - 1))} aria-label="Giảm">−</button>
            <input name="quantity" type="number" min={1} max={maxQty} value={qty} onChange={(e) => setQty(Math.min(maxQty, Math.max(1, Number(e.target.value) || 1)))} style={{ width: 84, height: 40, textAlign: "center", border: "1px solid var(--line)", borderRadius: 12, fontFamily: "inherit", fontSize: 15 }} />
            <button type="button" className="qty-btn" onClick={() => setQty(Math.min(maxQty, qtySafe + 1))} aria-label="Tăng">+</button>
          </div>
        </div>
        {loggedIn && <div className="sum-row"><span className="muted">{t.balance}</span><span>{fmtMoney(balanceCents, cur, lang)}</span></div>}
        <div className="sum-row total"><span>{t.total_wallet}</span><b style={{ color: "var(--accent)", fontFamily: "var(--font-display)", fontSize: 22 }}>{activePkg ? fmtMoney(totalCents, cur, lang) : "—"}</b></div>
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} type="submit" disabled={!activePkg}>
          {loggedIn ? t.buy_now : t.login_to_buy}
        </button>
        <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>{t.note}</p>
      </aside>
    </form>
  );
}
