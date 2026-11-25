import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { fmtMoney } from "@/lib/moneyfmt";
import { getPrefs } from "@/lib/prefs";
import { dict } from "@/lib/i18n";
import PrefsSwitch from "./PrefsSwitch";
import AuthGate from "./AuthGate";
import NotificationBell from "./NotificationBell";
import { getNotifications, countUnread } from "@/lib/notify";

export default async function SiteHeader({ siteName, logoUrl = "", covers = [], googleEnabled = false, facebookEnabled = false }: { siteName: string; logoUrl?: string; covers?: string[]; googleEnabled?: boolean; facebookEnabled?: boolean }) {
  const [user, prefs] = await Promise.all([getCurrentUser(), getPrefs()]);
  const [notifUnread, notifItems] = user
    ? await Promise.all([
        countUnread(user.id).catch(() => 0),
        getNotifications(user.id, 10).catch(() => []),
      ])
    : [0, []];
  const t = dict(prefs.lang);
  const [first, ...rest] = siteName.split(" ");
  return (
    <header className="site-header">
      <div className="container">
        {logoUrl ? (
          <Link href="/"><img src={logoUrl} alt={siteName} className="brand-logo" /></Link>
        ) : (
          <Link className="wordmark" href="/">
            <span className="dot" />
            {first}&nbsp;<em>{rest.join(" ") || "SHOP"}</em>
          </Link>
        )}
        <nav className="main-nav" aria-label="Chính">
          <Link href="/">{t.nav_home}</Link>
          <Link href="/games">{t.nav_games}</Link>
          <Link href="/account/orders">{t.nav_orders}</Link>
          <Link href="/support">{t.nav_support}</Link>
        </nav>
        <div className="header-actions">
          <PrefsSwitch lang={prefs.lang} cur={prefs.cur} currencies={prefs.currencies} enEnabled={prefs.enEnabled} names={prefs.currencyNames} />
          {user ? (
            <>
              <NotificationBell
                unread={notifUnread}
                items={notifItems.map((n) => ({
                  id: n.id,
                  kind: n.kind,
                  title: n.title,
                  body: n.body,
                  link: n.link,
                  read: !!n.readAt,
                  time: n.createdAt.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }),
                }))}
              />
              <Link className="btn btn-ghost btn-sm balance-chip" href="/account/deposit">{fmtMoney(user.balanceCents, prefs.cur, prefs.lang)}</Link>
              <Link className="btn btn-primary btn-sm user-name-chip" href="/account">{user.name.split(" ").slice(-1)[0]}</Link>
            </>
          ) : (
            <AuthGate siteName={siteName} covers={covers} googleEnabled={googleEnabled} facebookEnabled={facebookEnabled} loginLabel={t.login} registerLabel={t.register} />
          )}
        </div>
      </div>
    </header>
  );
}
