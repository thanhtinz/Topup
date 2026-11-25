import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { dict } from "@/lib/i18n";
import type { FloatingContact } from "@/lib/contact";

export default async function SiteFooter({ siteName, logoUrl = "", supportEmail, about, contacts = [] }: { siteName: string; logoUrl?: string; supportEmail: string; about?: string; contacts?: FloatingContact[] }) {
  const prefs = await getPrefs();
  const t = dict(prefs.lang);
  const [first, ...rest] = siteName.split(" ");
  const year = new Date().getFullYear();
  return (
    <>
      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              {logoUrl ? <img src={logoUrl} alt={siteName} className="footer-logo" /> : <span className="wordmark"><span className="dot" />{first}&nbsp;<em>{rest.join(" ") || "SHOP"}</em></span>}
              <p className="footer-about">{about?.trim() ? about : t.footer_about}</p>
            </div>
            <div className="footer-col">
              <h4>{t.footer_services}</h4>
              <ul>
                <li><Link href="/games">{t.f_all_games}</Link></li>
                <li><Link href="/#ban-chay">{t.f_best}</Link></li>
                <li><Link href="/#moi-them">{t.f_new}</Link></li>
                <li><Link href="/flash-sale">Flash Sale</Link></li>
                <li><Link href="/blog">{prefs.lang === "en" ? "News & Guides" : "Tin tức & Hướng dẫn"}</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>{t.footer_support}</h4>
              <ul>
                <li><Link href="/account/orders">{t.f_my_orders}</Link></li>
                <li><Link href="/support">{t.f_faq}</Link></li>
                <li><Link href="/support">{t.f_ticket}</Link></li>
                <li><Link href="/partnership">{t.f_partnership}</Link></li>
                <li><Link href="/status">{prefs.lang === "en" ? "System status" : "Trạng thái hệ thống"}</Link></li>
                <li><Link href="/api-docs">{prefs.lang === "en" ? "API documentation" : "Tài liệu API"}</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>{t.footer_legal}</h4>
              <ul>
                <li><Link href="/terms">{t.f_terms}</Link></li>
                <li><Link href="/privacy">{t.f_privacy}</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>{t.footer_contact}</h4>
              <ul>
                {contacts.map((c, i) => (
                  <li key={i}><a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{c.name}</a></li>
                ))}
                <li><a href={`mailto:${supportEmail}`}>{supportEmail}</a></li>
                <li><Link href="/support">{t.f_support247}</Link></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {year} {siteName}.</span>
            <span>{t.by} <strong>BNT Studio</strong></span>
          </div>
        </div>
      </footer>
      <nav className="tabbar" aria-label="Điều hướng dưới">
        <Link href="/" aria-current="page">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="m3 11 9-8 9 8"/><path d="M5 9.5V21h14V9.5"/></svg>
          {t.tab_home}
        </Link>
        <Link href="/games">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          {t.tab_services}
        </Link>
        <Link href="/account/deposit">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
          {t.tab_topup}
        </Link>
        <Link href="/account/orders">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3z"/><path d="M9 8h6M9 12h6"/></svg>
          {t.tab_orders}
        </Link>
        <Link href="/account">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>
          {t.tab_account}
        </Link>
      </nav>
    </>
  );
}
