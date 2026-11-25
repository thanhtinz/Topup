import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";
import { Top } from "./ui";
import { Icon } from "./AdminNav";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  DELIVERED: "green", PARTIAL: "amber", PROCESSING: "blue", PENDING: "amber", FAILED: "red", REFUNDED: "gray", CANCELLED: "gray",
};

export default async function AdminDashboard() {
  const [games, orders, users, depositsPending, revenue, recent] = await Promise.all([
    prisma.game.count({ where: { active: true } }),
    prisma.order.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.depositRequest.count({ where: { status: "PENDING" } }),
    prisma.order.aggregate({ _sum: { totalCents: true }, where: { status: { in: ["DELIVERED", "PARTIAL", "PROCESSING"] } } }),
    prisma.order.findMany({ include: { game: true, user: true }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const stats = [
    { icon: "box", value: String(games), label: "Game đang bán" },
    { icon: "receipt", value: String(orders), label: "Tổng đơn nạp" },
    { icon: "coins", value: fmtUSD(revenue._sum.totalCents ?? 0), label: "Doanh thu đơn" },
    { icon: "users", value: String(users), label: "Khách hàng" },
    { icon: "wallet", value: String(depositsPending), label: "Lệnh nạp chờ duyệt" },
  ];
  return (
    <div>
      <Top title="Bảng điều khiển" />
      <div className="stat-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <span className="stat-ico"><Icon name={s.icon} size={20} /></span>
            <b>{s.value}</b><span>{s.label}</span>
          </div>
        ))}
      </div>
      {depositsPending > 0 && (
        <div className="msg-err" style={{ background: "#FEF3E2", borderColor: "#F5D9A8", color: "#7A4A0D" }}>
          Có <b>{depositsPending} lệnh nạp tiền</b> đang chờ duyệt — <Link href="/admin/deposits" style={{ fontWeight: 700 }}>mở Duyệt nạp tiền</Link>
        </div>
      )}
      <div className="admin-card">
        <h2>Đơn gần nhất</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Mã</th><th>Khách</th><th>Game</th><th>Tổng</th><th>Trạng thái</th><th>Thời gian</th></tr></thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id}><td><b>{o.code}</b></td><td>{o.user.email}</td><td>{o.game.name}</td><td>{fmtUSD(o.totalCents)}</td><td><span className={`badge ${STATUS_BADGE[o.status] ?? ""}`}>{o.status}</span></td><td>{o.createdAt.toLocaleString("vi-VN")}</td></tr>
              ))}
              {!recent.length && <tr><td colSpan={6} className="muted">Chưa có đơn nào.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
