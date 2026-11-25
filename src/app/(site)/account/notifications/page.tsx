import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { markAllNotificationsReadAction } from "../engage-actions";

export const dynamic = "force-dynamic";

const KINDS: Array<[string, string]> = [
  ["", "Tất cả"],
  ["ORDER", "Đơn hàng"],
  ["DEPOSIT", "Nạp ví"],
  ["SYSTEM", "Hệ thống & giá"],
  ["REFUND", "Hoàn tiền"],
  ["PARTNERSHIP", "Partnership"],
  ["AFFILIATE", "Affiliate"],
];

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ msg?: string; kind?: string }> }) {
  const user = await requireUser();
  const { msg, kind } = await searchParams;
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id, kind: kind || undefined },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return (
    <main className="bsx">
      <div className="container" style={{ maxWidth: 880, paddingTop: 28, paddingBottom: 52 }}>
        <h1 style={{ fontSize: 24, marginBottom: 14 }}>Trung tâm thông báo</h1>
        {msg && <div className="form-ok" style={{ marginBottom: 12 }}>{msg}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
          {KINDS.map(([k, label]) => (
            <Link key={k} className={`btn btn-sm ${(kind ?? "") === k ? "btn-dark" : "btn-outline"}`} href={k ? `/account/notifications?kind=${k}` : "/account/notifications"}>{label}</Link>
          ))}
          {unread > 0 && (
            <form action={markAllNotificationsReadAction} style={{ marginLeft: "auto" }}>
              <button className="btn btn-outline btn-sm" type="submit">Đánh dấu đã đọc tất cả ({unread})</button>
            </form>
          )}
        </div>
        {items.length === 0 ? (
          <div className="crt-card" style={{ textAlign: "center", padding: "30px 20px" }}>
            <p className="muted">Chưa có thông báo nào ở mục này.</p>
          </div>
        ) : (
          <div className="crt-card">
            {items.map((n) => {
              const inner = (
                <>
                  <strong style={{ display: "block", fontSize: 14.5 }}>{n.title}</strong>
                  <span className="muted" style={{ display: "block", fontSize: 13.5, marginTop: 2 }}>{n.body}</span>
                  <span className="muted" style={{ fontSize: 12.5 }}>{n.createdAt.toLocaleString("vi-VN")} · {n.kind}</span>
                </>
              );
              const style: React.CSSProperties = { display: "block", padding: "11px 4px", borderTop: "1px solid #EEF3F9", background: n.readAt ? undefined : "#F5F9FE", borderRadius: 8, paddingLeft: 10, paddingRight: 10 };
              return n.link ? (
                <Link key={n.id} href={n.link} style={style}>{inner}</Link>
              ) : (
                <div key={n.id} style={style}>{inner}</div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
