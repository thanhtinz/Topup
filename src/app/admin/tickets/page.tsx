import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TICKET_STATUS_LABEL } from "@/lib/tickets";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "", label: "Tất cả" },
  { key: "OPEN", label: "Chờ hỗ trợ" },
  { key: "ANSWERED", label: "Đã trả lời" },
  { key: "CLOSED", label: "Đã đóng" },
];

export default async function AdminTicketsPage({ searchParams }: { searchParams: Promise<{ st?: string; msg?: string; err?: string }> }) {
  await requireAdmin();
  const { st = "", msg, err } = await searchParams;
  const where = st && TICKET_STATUS_LABEL[st] ? { status: st } : {};
  const [tickets, counts] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { user: { select: { name: true, email: true } }, _count: { select: { messages: true } } },
    }),
    prisma.ticket.groupBy({ by: ["status"], _count: true }),
  ]);
  const countOf = (k: string) => counts.find((c) => c.status === k)?._count ?? 0;
  const total = counts.reduce((a, c) => a + c._count, 0);
  return (
    <>
      <h1 className="page-title">Ticket hỗ trợ</h1>
      {msg && <div className="form-ok">{msg}</div>}
      {err && <div className="form-err">{err}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
        {TABS.map((tab) => {
          const n = tab.key ? countOf(tab.key) : total;
          const active = st === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.key ? `/admin/tickets?st=${tab.key}` : "/admin/tickets"}
              className={active ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
            >
              {tab.label} ({n})
            </Link>
          );
        })}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Chủ đề</th>
              <th>Khách hàng</th>
              <th>Đơn liên quan</th>
              <th>Trạng thái</th>
              <th>Tin nhắn</th>
              <th>Cập nhật</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td><b>{t.code}</b></td>
                <td style={{ whiteSpace: "normal", maxWidth: 300 }}>{t.subject}</td>
                <td style={{ whiteSpace: "normal" }}>{t.user.name}<div className="muted">{t.user.email}</div></td>
                <td>{t.orderCode ?? "—"}</td>
                <td><span className="badge">{TICKET_STATUS_LABEL[t.status] ?? t.status}</span></td>
                <td>{t._count.messages}</td>
                <td>{t.updatedAt.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</td>
                <td><Link className="btn btn-ghost btn-sm" href={`/admin/tickets/${t.id}`}>Mở</Link></td>
              </tr>
            ))}
            {!tickets.length && <tr><td colSpan={8} className="muted">Chưa có ticket nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
