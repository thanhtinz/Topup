import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmtMoney } from "@/lib/moneyfmt";
import { getPrefs } from "@/lib/prefs";
import { getSettings } from "@/lib/settings";
import { pointsConfig, getVipTiers, resolveTier, spend30dCents } from "@/lib/points";
import { ORDER_GROUPS } from "@/lib/order-groups";
import { logoutAction } from "../../actions";
import ProfileHead from "./ProfileHead";
import { quickTopups } from "@/lib/engage";

export const dynamic = "force-dynamic";

const GROUP_ICONS: Record<string, React.ReactNode> = {
  wait: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>),
  doing: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></svg>),
  done: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m8.5 12.2 2.4 2.4 4.6-5" /></svg>),
  cancel: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></svg>),
  refund: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>),
};

const chev = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
);

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const prefs = await getPrefs();
  const { msg, err } = await searchParams;
  const s = await getSettings();
  const [discountCount, ptsCfg, spend30, tiers] = await Promise.all([
    s.module_discount === "1"
      ? prisma.discountCode.count({ where: { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } })
      : Promise.resolve(0),
    pointsConfig(),
    spend30dCents(user.id),
    getVipTiers(),
  ]);
  const myPartner = await prisma.partner.findUnique({ where: { userId: user.id }, select: { id: true } });
  const myTier = ptsCfg.enabled ? resolveTier(spend30, tiers) : null;
  const quicks = await quickTopups(user.id, 4);
  const firstCouponTier = tiers.find((t) => t.couponPercent > 0);
  const firstLateTier = tiers.find((t) => t.lateComp);
  const vipIcon = myTier?.iconUrl || null;
  const customerCode = "KH" + String(user.id).padStart(5, "0");

  return (
    <main className="pf-wrap">
      <div className="pf-col">
        {msg && <div className="form-ok">{msg}</div>}
        {err && <div className="form-err">{err}</div>}


        <section className="pf-card">
          <ProfileHead name={user.name} email={user.email} customerCode={customerCode} />
          <div className="pf-banner">
            <div className="pf-banner-top">
              <span className="crown">
                {vipIcon
                  ? <img src={vipIcon} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />
                  : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7Z" /><path d="M5 20h14" /></svg>}
              </span>
              <b>{ptsCfg.enabled ? "Nâng hạng để nhận thêm đặc quyền" : "Nạp ví tự động 24/7 — tiền về ví ngay, không chờ duyệt"}</b>
              <Link className="pf-banner-btn" href={ptsCfg.enabled ? "/account/vip" : "/account/deposit"}>{ptsCfg.enabled ? "Xem tất cả ›" : "Nạp ngay ›"}</Link>
            </div>
            {ptsCfg.enabled && (
              <div className="pf-perks">
                {firstCouponTier && (
                  <span className="pf-perk">
                    <svg className="pf-perk-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2M13 11v2M13 17v2" /></svg>
                    <span className="pf-perk-tx">Khuyến mãi tháng</span>
                    {!(myTier && myTier.couponPercent > 0) && (
                      <span className="pf-perk-lock"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></span>
                    )}
                  </span>
                )}
                {firstLateTier && (
                  <span className="pf-perk">
                    <svg className="pf-perk-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                    <span className="pf-perk-tx">Bồi thường chậm trễ</span>
                    {!myTier?.lateComp && (
                      <span className="pf-perk-lock"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></span>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="pf-card" style={{ paddingTop: 18, paddingBottom: 18 }}>
          <div className="pf-stats">
            <div className="pf-stat">
              <Link href="/account/deposit" style={{ color: "inherit", display: "block" }} aria-label="Nạp ví">
                <b>{fmtMoney(user.balanceCents, prefs.cur, prefs.lang)}</b>
                <span>Ví</span>
              </Link>
            </div>
            <div className="pf-stat">
              <Link href="/discounts" style={{ color: "inherit" }}>
                <b>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#E0245E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="m9 12 2 2 4-4" /></svg>
                  {discountCount}
                </b>
                <span>Mã giảm giá</span>
              </Link>
            </div>
            <div className="pf-stat">
              <Link href="/account/points" style={{ color: "inherit" }}>
                <b>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m12 7.5 1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3L7.2 11l3.3-.5 1.5-3Z" /></svg>
                  {user.points.toLocaleString("vi-VN")}
                </b>
                <span>Điểm của tôi</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="pf-card">
          <div className="pf-orders-head">
            <span className="bar" />
            <h2>Đơn hàng</h2>
            <Link href="/account/orders">Tất cả đơn ›</Link>
          </div>
          <div className="pf-shortcuts">
            {ORDER_GROUPS.map((g) => (
              <Link key={g.key} className="pf-shortcut" href={`/account/orders?g=${g.key}`}>
                {GROUP_ICONS[g.key]}
                {g.label}
              </Link>
            ))}
          </div>
        </section>

        {quicks.length > 0 && (
          <section className="pf-card">
            <div className="pf-orders-head">
              <span className="bar" />
              <h2>Nạp lại nhanh</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {quicks.map((q) => (
                <Link key={q.gameId} href={`/game/${q.gameSlug}?quick=1`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid #E6EDF6", borderRadius: 12 }}>
                  {q.gameCover ? <img src={q.gameCover} alt="" style={{ width: 42, height: 42, borderRadius: 9, objectFit: "cover" }} referrerPolicy="no-referrer" /> : null}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: "block", fontSize: 14.5 }}>{q.gameName}</b>
                    <span className="muted" style={{ fontSize: 13 }}>{q.packageName} · {fmtMoney(q.priceCents, prefs.cur, prefs.lang)}{Object.values(q.fields).filter(Boolean).length ? ` · ${Object.values(q.fields).filter(Boolean).join(" · ")}` : ""}</span>
                  </span>
                  <span className="btn btn-primary btn-sm">Nạp lại</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="pf-card pf-menu">
          <Link href="/account/wishlist">
            <span className="m-ico"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg></span>
            Game & gói yêu thích
            <span className="chev">{chev}</span>
          </Link>
          <Link href="/account/alerts">
            <span className="m-ico"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r="1" fill="currentColor" /><path d="m15 5-4 4" /></svg></span>
            Báo giá đang theo dõi
            <span className="chev">{chev}</span>
          </Link>
          <Link href="/account/notifications">
            <span className="m-ico"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9Z" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></svg></span>
            Trung tâm thông báo
            <span className="chev">{chev}</span>
          </Link>
          <Link href="/account/points">
            <span className="m-ico"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M14.8 9.2A2.4 2.4 0 0 0 12.6 8h-.9a2.25 2.25 0 0 0 0 4.5h.6a2.25 2.25 0 0 1 0 4.5h-1a2.4 2.4 0 0 1-2.1-1.2" /><path d="M12 6.5v11" /></svg></span>
            Điểm của tôi
            <span className="chev">{chev}</span>
          </Link>
          <Link href="/account/api-keys">
            <span className="m-ico"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="15.5" r="4.5" /><path d="m11.2 12.3 8.3-8.3" /><path d="m16 5 2.5 2.5" /><path d="m13.5 7.5 2 2" /></svg></span>
            API đấu nối
            <span className="chev">{chev}</span>
          </Link>
          <Link href="/partnership">
            <span className="m-ico"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m11 17 2 2a1 1 0 1 0 3-3" /><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" /><path d="m21 3 1 11h-2" /><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" /><path d="M3 4h8" /></svg></span>
            Hợp tác cùng BNTGame
            <span className="chev">{chev}</span>
          </Link>
          {myPartner && (
            <Link href="/partner">
              <span className="m-ico"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M8 15h5" /></svg></span>
              Partner Portal
              <span className="chev">{chev}</span>
            </Link>
          )}
          <Link href="/support">
            <span className="m-ico"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Z" /><path d="M21 14h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-5Z" /><path d="M3 14v-2a9 9 0 0 1 18 0v2" /></svg></span>
            Kênh hỗ trợ
            <span className="chev">{chev}</span>
          </Link>
          {(user.role === "ADMIN" || user.role === "STAFF") && (
            <a href={s.admin_entry_url || "/admin"}>
              <span className="m-ico"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg></span>
              Trang quản trị
              <span className="chev">{chev}</span>
            </a>
          )}
        </section>

        <form action={logoutAction}>
          <button className="pf-logout" type="submit">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg>
            Đăng xuất
          </button>
        </form>
      </div>
    </main>
  );
}
