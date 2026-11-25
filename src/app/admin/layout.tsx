import Link from "next/link";
import "./admin.css";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { logoutAction } from "@/app/actions";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { hasAdmin } from "@/lib/setup";
import AdminNav, { Icon, type NavGroup } from "./AdminNav";
import AdminBurger from "./AdminBurger";
import AdminLive, { type AdminCounts } from "./AdminLive";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasAdmin())) redirect("/setup");
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname === "/admin/login") return <>{children}</>;
  const admin = await requireAdmin();
  const [pendingDeposits, openTickets, processingOrders, pendingCreatorApps, pendingCreatorPayouts, newPartnerApps, pendingPartnerPayments] = await Promise.all([
    prisma.depositRequest.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.ticket.count({ where: { status: "OPEN" } }).catch(() => 0),
    prisma.order.count({ where: { status: { in: ["PROCESSING", "PARTIAL"] } } }).catch(() => 0),
    prisma.creatorApplication.count({ where: { status: { in: ["PENDING", "UNDER_REVIEW"] } } }).catch(() => 0),
    prisma.creatorPayout.count({ where: { status: { in: ["PENDING", "APPROVED", "PROCESSING"] } } }).catch(() => 0),
    prisma.partnerApplication.count({ where: { status: "SUBMITTED" } }).catch(() => 0),
    prisma.partnerPayment.count({ where: { status: "PENDING_APPROVAL" } }).catch(() => 0),
  ]);
  const liveCounts: AdminCounts = { deposits: pendingDeposits, tickets: openTickets, orders: processingOrders, creatorApps: pendingCreatorApps, creatorPayouts: pendingCreatorPayouts, partnerApps: newPartnerApps, partnerPayments: pendingPartnerPayments };
  const groups: NavGroup[] = [
    {
      title: "Tổng quan",
      items: [{ href: "/admin", label: "Bảng điều khiển", icon: "grid" }],
    },
    {
      title: "Bán hàng",
      items: [
        { href: "/admin/games", label: "Quản lý game", icon: "box" },
        { href: "/admin/orders", label: "Đơn nạp", icon: "receipt", count: processingOrders, countKey: "orders" },
        { href: "/admin/discounts", label: "Mã giảm giá", icon: "tag" },
        { href: "/admin/flash-sales", label: "Flash Sale", icon: "tag" },
        { href: "/admin/blog", label: "Blog & Tin tức", icon: "image" },
        { href: "/admin/status", label: "Trạng thái hệ thống", icon: "chart" },
        { href: "/admin/steam", label: "Steam Top-Up", icon: "wallet" },
        { href: "/admin/steam-gift", label: "Steam Gift", icon: "wallet" },
        { href: "/admin/telegram", label: "Telegram", icon: "wallet" },
        {
          href: "/admin/partnership", label: "Partnership", icon: "users", count: newPartnerApps + pendingPartnerPayments, countKey: "partnerTotal",
          children: [
            { href: "/admin/partnership", label: "Tổng quan", icon: "grid" },
            { href: "/admin/partnership/applications", label: "Đơn hợp tác", icon: "mail", count: newPartnerApps, countKey: "partnerApps" },
            { href: "/admin/partnership/partners", label: "Đối tác", icon: "users" },
            {
              href: "/admin/partnership/affiliate", label: "Affiliate", icon: "coins", count: pendingCreatorPayouts, countKey: "creatorPayouts",
              children: [
                { href: "/admin/partnership/affiliate", label: "Tổng quan", icon: "grid" },
                { href: "/admin/partnership/affiliate/list", label: "Danh sách Affiliate", icon: "users" },
                { href: "/admin/partnership/affiliate/levels", label: "Cấp độ", icon: "chart" },
                { href: "/admin/partnership/affiliate/commissions", label: "Hoa hồng", icon: "coins" },
                { href: "/admin/partnership/affiliate/payouts", label: "Rút tiền", icon: "wallet", count: pendingCreatorPayouts, countKey: "creatorPayouts" },
                { href: "/admin/partnership/affiliate/campaigns", label: "Chiến dịch", icon: "flag" },
                { href: "/admin/partnership/affiliate/media", label: "Media Kit", icon: "image" },
                { href: "/admin/partnership/affiliate/settings", label: "Cài đặt", icon: "gear" },
              ],
            },
            { href: "/admin/partnership/proposals", label: "Đề xuất", icon: "receipt" },
            { href: "/admin/partnership/types", label: "Loại hình", icon: "tag" },
            { href: "/admin/partnership/campaigns", label: "Chiến dịch", icon: "flag" },
            { href: "/admin/partnership/deliverables", label: "Đầu việc", icon: "box" },
            { href: "/admin/partnership/agreements", label: "Thỏa thuận", icon: "receipt" },
            { href: "/admin/partnership/payments", label: "Thanh toán", icon: "wallet", count: pendingPartnerPayments, countKey: "partnerPayments" },
            { href: "/admin/partnership/settings", label: "Cài đặt", icon: "gear" },
          ],
        },
      ],
    },
    {
      title: "Khách hàng",
      items: [
        { href: "/admin/users", label: "Khách hàng & ví", icon: "users" },
        { href: "/admin/deposits", label: "Duyệt nạp tiền", icon: "wallet", count: pendingDeposits, countKey: "deposits" },
        { href: "/admin/tickets", label: "Ticket hỗ trợ", icon: "chat", count: openTickets, countKey: "tickets" },
      ],
    },
    {
      title: "Nguồn hàng",
      items: [
        { href: "/admin/providers", label: "Tất cả nhà cung cấp", icon: "server" },
        { href: "/admin/compare", label: "So sánh giá 2 nguồn", icon: "layers" },
      ],
    },
    {
      title: "Hệ thống",
      items: [
        { href: "/admin/payments", label: "Cấu hình nạp tiền", icon: "wallet" },
        { href: "/admin/points", label: "Quản lý điểm", icon: "coins" },
        { href: "/admin/vip", label: "Quản lý VIP", icon: "tag" },
        { href: "/admin/modules", label: "Quản lý module", icon: "puzzle" },
        { href: "/admin/widgets", label: "Widget liên hệ", icon: "chat" },
        { href: "/admin/currencies", label: "Tiền tệ", icon: "coins" },
        { href: "/admin/languages", label: "Ngôn ngữ", icon: "globe" },
        { href: "/admin/website", label: "Cấu hình website", icon: "gear" },
        { href: "/admin/audit", label: "Nhật ký", icon: "list" },
      ],
    },
  ];
  const siteSettings = await getSettings().catch(() => null);
  const brandName = siteSettings?.site_name?.trim() || "BNT Game";
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-brand">
          <span className="mark">{brandName.charAt(0).toUpperCase()}</span>
          <b>{brandName}</b>
          <span className="admin-badge">ADMIN</span>
        </div>
        <AdminNav groups={groups} />
        <div className="side-foot">
          <Link href="/" className="nav-item">
            <Icon name="globe" />
            <span>Xem website</span>
          </Link>
        </div>
      </aside>
      <div className="admin-col">
        <div className="admin-top">
          <AdminBurger />
          <form className="top-search" action="/admin/orders" method="get" role="search">
            <Icon name="search" size={18} />
            <input name="q" placeholder="Tìm mã đơn, email khách…" aria-label="Tìm kiếm trong admin" />
          </form>
          <div className="top-right">
            <AdminLive initial={liveCounts} />
            <form action={logoutAction}>
              <button className="btn btn-primary btn-sm" type="submit">Đăng xuất</button>
            </form>
          </div>
        </div>
        <main className="admin-main">{children}</main>
        <footer className="admin-footer">
          <span>© {new Date().getFullYear()} {brandName} — Khu vực quản trị</span>
          <span>Thiết kế và vận hành bởi <b>BNT Studio</b></span>
        </footer>
      </div>
    </div>
  );
}
