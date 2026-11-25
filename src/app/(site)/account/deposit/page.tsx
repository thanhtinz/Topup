import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";
import { fmtMoney } from "@/lib/moneyfmt";
import { getPrefs } from "@/lib/prefs";
import { getSepayConfig, getBntpayConfig, currentVndRate } from "@/lib/gateways";
import { getSettings } from "@/lib/settings";
import DepositForm, { type WalletMethod } from "./DepositForm";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = { SEPAY: "QR ngân hàng", BNTPAY: "USDT" };
const KIND_LABEL: Record<string, string> = {
  deposit: "Nạp ví",
  purchase: "Mua gói nạp",
  refund: "Hoàn tiền",
  admin_adjust: "Điều chỉnh",
  bonus: "Thưởng nạp",
};
const fmtVND = (n: number) => "₫" + n.toLocaleString("vi-VN");

const TABS = [
  { key: "nap", label: "Nạp tiền" },
  { key: "lichsu", label: "Lịch sử nạp" },
  { key: "giaodich", label: "Giao dịch" },
] as const;

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; tab?: string }> }) {
  const user = await requireUser();
  const { msg, err, tab } = await searchParams;
  const activeTab = TABS.some((t) => t.key === tab) ? tab! : "nap";
  const prefs = await getPrefs();
  const [sepay, bntpay, rate, s] = await Promise.all([getSepayConfig(), getBntpayConfig(), currentVndRate(), getSettings()]);
  const methods: WalletMethod[] = [
    ...(sepay.enabled ? [{ code: "SEPAY", tab: "QR ngân hàng" }] : []),
    ...(bntpay.enabled ? [{ code: "BNTPAY", tab: "USDT" }] : []),
  ];
  const [deposits, txns] = await Promise.all([
    activeTab === "lichsu" ? prisma.depositRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }) : Promise.resolve([]),
    activeTab === "giaodich" ? prisma.walletTxn.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }) : Promise.resolve([]),
  ]);
  const balanceMain = fmtMoney(user.balanceCents, prefs.cur, prefs.lang);
  const balanceApprox = prefs.cur.code === "VND"
    ? `(≈ ${fmtUSD(user.balanceCents)})`
    : rate > 0 ? `(≈ ${fmtVND(Math.round((user.balanceCents / 100) * rate))})` : "";

  return (
    <main className="pf-wrap">
      <div className="pf-col">
        {msg && <div className="form-ok">{msg}</div>}
        {err && <div className="form-err">{err}</div>}

        <section className="pf-card wl-card">
          <div className="wl-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
            Thanh toán an toàn
          </div>
          <div className="wl-title">
            Ví của tôi
            <span className="info">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
            </span>
          </div>
          <div className="wl-balance">
            <b>{balanceMain}</b>
            {balanceApprox && <span>{balanceApprox}</span>}
          </div>
          <span className="wl-watermark">
            <svg width="168" height="168" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
          </span>
        </section>

        <div className="wl-tabs" role="tablist" aria-label="Ví">
          {TABS.map((t) => (
            <Link key={t.key} role="tab" aria-selected={activeTab === t.key} className={`wl-tab ${activeTab === t.key ? "on" : ""}`} href={t.key === "nap" ? "/account/deposit" : `/account/deposit?tab=${t.key}`}>
              {t.label}
            </Link>
          ))}
        </div>
        <section className="wl-panel">
          {activeTab === "nap" && <DepositForm methods={methods} rate={rate} minVnd={parseInt(s.deposit_min_vnd ?? "", 10) || 130000} maxVnd={parseInt(s.deposit_max_vnd ?? "", 10) || 13000000} />}

          {activeTab === "lichsu" && (
            <div>
              {deposits.map((d) => (
                <div key={d.id} className="wl-row">
                  <div className="r-main">
                    <div className="r-title"><Link href={`/account/deposit/${d.code}`} style={{ color: "var(--accent)" }}>{d.code}</Link> · {METHOD_LABEL[d.method] ?? d.method}</div>
                    <div className="r-sub">{d.createdAt.toLocaleString("vi-VN")}</div>
                  </div>
                  <div>
                    <div className="r-amt">{fmtUSD(d.amountCents)}</div>
                    <div className="r-sub" style={{ textAlign: "right" }}>
                      <span className={`badge ${d.status === "APPROVED" ? "green" : d.status === "REJECTED" ? "red" : ""}`}>{d.status === "APPROVED" ? "Đã cộng" : d.status === "REJECTED" ? "Đã từ chối" : "Chờ thanh toán"}</span>
                    </div>
                  </div>
                </div>
              ))}
              {!deposits.length && <p className="muted">Chưa có lệnh nạp nào.</p>}
            </div>
          )}

          {activeTab === "giaodich" && (
            <div>
              {txns.map((t) => (
                <div key={t.id} className="wl-row">
                  <div className="r-main">
                    <div className="r-title">{KIND_LABEL[t.kind.toLowerCase()] ?? t.kind}</div>
                    <div className="r-sub">{t.createdAt.toLocaleString("vi-VN")}{t.note ? ` · ${t.note}` : ""}</div>
                  </div>
                  <div>
                    <div className="r-amt" style={{ color: t.deltaCents >= 0 ? "#177245" : "#B3261E" }}>{t.deltaCents >= 0 ? "+" : ""}{fmtUSD(t.deltaCents)}</div>
                    <div className="r-sub" style={{ textAlign: "right" }}>Số dư {fmtUSD(t.balanceAfter)}</div>
                  </div>
                </div>
              ))}
              {!txns.length && <p className="muted">Chưa có giao dịch nào.</p>}
            </div>
          )}
        </section>

        <p style={{ textAlign: "center" }}>
          <Link href="/account" style={{ color: "var(--ink-2)", fontSize: 14.5, fontWeight: 600 }}>← Về trang hồ sơ</Link>
        </p>
      </div>
    </main>
  );
}
