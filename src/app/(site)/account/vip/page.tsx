import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";
import { pointsConfig, getVipTiers, resolveTier, spend30dCents, ensureMonthlyCoupon, checkLateCompensation } from "@/lib/points";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const lockSvg = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);
const crownSvg = (
  <svg width="92" height="92" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.4" strokeLinejoin="round"><path d="m2.5 5 3.2 11.5h12.6L21.5 5l-5.8 6.4L12 4.6 8.3 11.4 2.5 5Z" /><path d="M5.7 20h12.6" strokeWidth="1.6" strokeLinecap="round" fill="none" /></svg>
);

export default async function VipPage() {
  const user = await requireUser();
  const cfg = await pointsConfig();
  const tiers = await getVipTiers();
  const spend = await spend30dCents(user.id);
  const tier = resolveTier(spend, tiers);
  const tierIdx = tier ? tiers.findIndex((t) => t.id === tier.id) : -1;
  await checkLateCompensation(user.id, tier, cfg);
  const coupon = await ensureMonthlyCoupon(user.id, tier, cfg);
  const initial = (user.name || user.email || "B").trim().charAt(0).toUpperCase();
  const nextTier = tierIdx >= 0 && tierIdx < tiers.length - 1 ? tiers[tierIdx + 1] : null;
  const firstCouponTier = tiers.find((t) => t.couponPercent > 0);
  const firstLateTier = tiers.find((t) => t.lateComp);
  const firstDiscountTier = tiers.find((t) => t.discountPercent > 0);
  const maxDiscount = tiers.reduce((m, t) => Math.max(m, t.discountPercent), 0);
  const hasPerks = Boolean(firstDiscountTier || firstCouponTier || firstLateTier);
  const settings = await getSettings();
  const fillFaq = (a: string) => a
    .replaceAll("{tiers_clause}", tiers.length ? `, gồm các hạng ${tiers.map((t) => t.name).join(", ")}` : "")
    .replaceAll("{thresholds_clause}", tiers.some((t) => t.thresholdCents > 0) ? `Ngưỡng hiện tại: ${tiers.filter((t) => t.thresholdCents > 0).map((t) => `${t.name} từ ${fmtUSD(t.thresholdCents)}`).join(", ")}.` : "Hiện chưa có hạng nào được mở.")
    .replaceAll("{per_review}", String(cfg.perReview))
    .replaceAll("{daily_cap}", String(cfg.dailyCap))
    .replaceAll("{max_pay_percent}", String(cfg.maxPayPercent));
  const faqItems = (settings.vip_faq ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => { const i = l.indexOf("|"); return i > 0 ? { q: l.slice(0, i).trim(), a: fillFaq(l.slice(i + 1).trim()) } : { q: l, a: "" }; })
    .filter((x) => x.q);
  const crownOf = (t: (typeof tiers)[number]) => t.iconUrl ? <img src={t.iconUrl} alt="" style={{ width: 92, height: 92, objectFit: "contain" }} /> : crownSvg;

  return (
    <main className="pf-wrap">
      <div className="pf-col">
        <p className="crumb"><Link href="/account">← Hồ sơ</Link></p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, margin: "4px 0 4px" }}>Câu lạc bộ</h1>
        <p className="muted" style={{ marginBottom: 14, fontSize: 13.5 }}>Đánh giá đơn hàng để tích điểm và dùng điểm khi thanh toán.</p>

        <section className="vip-panel">
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, display: "flex", alignItems: "center", gap: 9 }}>
            {tier?.iconUrl ? <img src={tier.iconUrl} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} /> : null}
            VIP
          </div>
          {tiers.length === 0 && <p className="muted" style={{ fontSize: 13.5, margin: "10px 0 4px" }}>Chưa có hạng VIP nào. Các hạng sẽ hiện ở đây khi được tạo.</p>}
          <div className="vip-steps">
            {tiers.map((t, i) => (
              <div key={t.id} style={{ display: "contents" }}>
                {i > 0 && <div className="vip-line" />}
                <div className={`vip-step ${i < tierIdx ? "done" : i === tierIdx ? "cur" : ""}`}>
                  <div className="vip-dot">{i + 1}</div>
                  <span>{t.name}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="vip-cards">
            {tiers.map((t, i) => (
              <div key={t.id} className={`vip-card ${i === tierIdx ? "cur" : ""}`}>
                <div className="v-head">
                  <span className="vip-avatar">{initial}</span>
                  <span className="vip-name">{t.name}</span>
                  {i === tierIdx && <span className="vip-pill">Hạng của bạn</span>}
                </div>
                <span className="vip-crown">{crownOf(t)}</span>
                <div className="vip-spend">
                  Chi tiêu 30 ngày
                  <b>{fmtUSD(spend)}{i === tierIdx && nextTier ? <span className="of"> / {fmtUSD(nextTier.thresholdCents)}</span> : ""}</b>
                </div>
                {t.discountPercent > 0 && <div className="vip-next" style={{ color: "var(--accent)", fontWeight: 700 }}>Giảm {t.discountPercent}% mọi đơn nạp</div>}
                <div className="vip-next">
                  {i === tierIdx
                    ? nextTier
                      ? `Chi thêm ${fmtUSD(nextTier.thresholdCents - spend)} để lên ${nextTier.name}`
                      : "Bạn đang ở hạng cao nhất"
                    : i < tierIdx
                      ? "Đã đạt hạng này"
                      : `Cần chi tiêu ${fmtUSD(t.thresholdCents)} trong 30 ngày`}
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, margin: "16px 0 10px" }}>Quyền lợi VIP</div>
          {!hasPerks && <p className="muted" style={{ fontSize: 13, margin: "0 0 6px" }}>Chưa có quyền lợi nào được mở ở các hạng.</p>}
          <div className="perk-grid">
            {firstDiscountTier && (
              <div className="perk-card">
                {(!tier || tier.discountPercent <= 0) && <span className="perk-lock">{lockSvg} {firstDiscountTier.name}</span>}
                <span className="p-ico">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M19 5 5 19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>
                </span>
                <b>Giảm giá mọi đơn</b>
                {tier && tier.discountPercent > 0 ? (
                  <p className="muted" style={{ fontSize: 12, marginTop: 5 }}>Đang giảm {tier.discountPercent}%{maxDiscount > tier.discountPercent ? ` · cao nhất ${maxDiscount}%` : ""}</p>
                ) : maxDiscount > (firstDiscountTier?.discountPercent ?? 0) ? (
                  <p className="muted" style={{ fontSize: 12, marginTop: 5 }}>Tới {maxDiscount}% ở hạng cao nhất</p>
                ) : null}
              </div>
            )}
            {tiers.length > 0 && (
            <div className="perk-card">
              {(!tier || tier.couponPercent <= 0) && firstCouponTier && <span className="perk-lock">{lockSvg} {firstCouponTier.name}</span>}
              <span className="p-ico">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2M13 17v2M13 11v2" /></svg>
              </span>
              <b>Khuyến mãi tháng</b>
              {tier && tier.couponPercent > 0 && coupon ? (
                <>
                  <div><span className="perk-code">{coupon}</span></div>
                  <p className="muted" style={{ fontSize: 12, marginTop: 5 }}>Giảm {tier.couponPercent}% · 1 lượt · hết hạn cuối tháng</p>
                </>
              ) : !firstCouponTier ? (
                <p className="muted" style={{ fontSize: 12, marginTop: 5 }}>Hiện chưa mở quyền lợi này.</p>
              ) : null}
            </div>
            )}
            {tiers.length > 0 && (
            <div className="perk-card">
              {(!tier || !tier.lateComp) && firstLateTier && <span className="perk-lock">{lockSvg} {firstLateTier.name}</span>}
              <span className="p-ico">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              </span>
              <b>Bồi thường chậm trễ</b>
              {tier?.lateComp ? (
                <p className="muted" style={{ fontSize: 12, marginTop: 5 }}>Đã mở · +{cfg.vipLatePoints} điểm khi giao chậm quá {cfg.vipLateHours}h</p>
              ) : !firstLateTier ? (
                <p className="muted" style={{ fontSize: 12, marginTop: 5 }}>Hiện chưa mở quyền lợi này.</p>
              ) : null}
            </div>
            )}
          </div>
        </section>

        <section className="pf-card">
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, margin: "0 0 4px" }}>Câu hỏi thường gặp về VIP</h2>
{faqItems.map((f, i) => (
            <details key={i} className="faq-item" open={i === 0}>
              <summary>{f.q}</summary>
              {f.a ? <p>{f.a}</p> : null}
            </details>
          ))}
        </section>
      </div>
    </main>
  );
}
