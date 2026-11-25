"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const I = {
  grid: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" /></svg>,
  link: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 14a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 0 0-7.1-7.1l-1.7 1.7" /><path d="M14 10a5 5 0 0 0-7.1 0L4.5 12.4a5 5 0 0 0 7.1 7.1l1.7-1.7" /></svg>,
  tag: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.6 3.6 21 12a2 2 0 0 1 0 2.8l-6.2 6.2A2 2 0 0 1 12 21L3 12V3h9l.6.6Z" /><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" /></svg>,
  coins: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="9" r="6" /><path d="M14.5 5.6a6 6 0 1 1-8.1 8.9" /></svg>,
  flag: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V4" /><path d="M4 5h13.5L15 9.5l2.5 4.5H4" /></svg>,
  image: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="1.8" /><path d="m21 15.5-4.8-4.8L6 21" /></svg>,
  wallet: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2" /><path d="M3 7v10a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2Z" /><circle cx="16.8" cy="14" r="1.2" fill="currentColor" stroke="none" /></svg>,
  user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></svg>,
};

const ITEMS: Array<[string, string, React.ReactNode]> = [
  ["/creator/dashboard", "Tổng quan", I.grid],
  ["/creator/links", "Đường dẫn", I.link],
  ["/creator/coupons", "Mã giảm giá", I.tag],
  ["/creator/commissions", "Hoa hồng", I.coins],
  ["/creator/campaigns", "Chiến dịch", I.flag],
  ["/creator/media-kit", "Media Kit", I.image],
  ["/creator/payouts", "Rút tiền", I.wallet],
  ["/creator/settings", "Hồ sơ", I.user],
];

export default function CreatorNav() {
  const path = usePathname();
  return (
    <nav className="crt-nav">
      {ITEMS.map(([href, label, icon]) => (
        <Link key={href} href={href} className={path === href ? "on" : ""}>{icon}{label}</Link>
      ))}
    </nav>
  );
}
