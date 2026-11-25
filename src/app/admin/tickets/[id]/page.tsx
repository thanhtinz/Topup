import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adminReplyTicketAction, adminTicketStatusAction } from "@/app/admin/actions";
import { TICKET_STATUS_LABEL } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export default async function AdminTicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { msg, err } = await searchParams;
  const t = await prisma.ticket.findUnique({
    where: { id: parseInt(id, 10) || 0 },
    include: {
      user: { select: { name: true, email: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!t) notFound();
  const closed = t.status === "CLOSED";
  return (
    <>
      <p style={{ margin: "0 0 8px" }}>
        <Link href="/admin/tickets">← Tất cả ticket</Link>
      </p>
      <h1 className="page-title" style={{ marginBottom: 4 }}>{t.code} — {t.subject}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Khách: <b>{t.user.name}</b> ({t.user.email})
        {t.orderCode ? <> · Đơn liên quan: <b>{t.orderCode}</b></> : null}
        {" "}· Trạng thái: <span className="badge">{TICKET_STATUS_LABEL[t.status] ?? t.status}</span>
      </p>
      {msg && <div className="form-ok">{msg}</div>}
      {err && <div className="form-err">{err}</div>}

      <div style={{ display: "grid", gap: 12, marginTop: 16, maxWidth: 820 }}>
        {t.messages.map((m) => (
          <div key={m.id} className="card" style={m.fromStaff ? { borderColor: "var(--accent, #0B63E5)" } : undefined}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <b>{m.fromStaff ? "Đội hỗ trợ" : t.user.name}</b>
              <span className="muted" style={{ fontSize: 12.5 }}>
                {m.createdAt.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}
              </span>
            </div>
            <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{m.body}</p>
          </div>
        ))}
      </div>

      {!closed && (
        <form action={adminReplyTicketAction} className="card" style={{ display: "grid", gap: 12, marginTop: 18, maxWidth: 820 }}>
          <input type="hidden" name="ticketId" value={t.id} />
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="adm-tk-reply">Trả lời khách</label>
            <textarea id="adm-tk-reply" name="body" required maxLength={4000} rows={4} placeholder="Nhập nội dung trả lời..." style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: "11px 13px", fontFamily: "inherit", fontSize: 15, resize: "vertical" }} />
          </div>
          <div>
            <button className="btn btn-primary" type="submit">Gửi trả lời</button>
          </div>
        </form>
      )}

      <form action={adminTicketStatusAction} style={{ marginTop: 16 }}>
        <input type="hidden" name="ticketId" value={t.id} />
        <input type="hidden" name="kind" value={closed ? "reopen" : "close"} />
        <button className="btn btn-outline btn-sm" type="submit">{closed ? "Mở lại ticket" : "Đóng ticket"}</button>
      </form>
    </>
  );
}
