import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { replyTicketAction, closeTicketAction } from "@/app/actions";
import { TICKET_STATUS_LABEL } from "@/lib/tickets";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  OPEN: "#B45309",
  ANSWERED: "#15803D",
  CLOSED: "#6B7280",
};

export default async function TicketThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const user = await requireUser();
  const { code } = await params;
  const { msg, err } = await searchParams;
  const t = await prisma.ticket.findFirst({
    where: { code, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!t) notFound();
  const closed = t.status === "CLOSED";
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 760 }}>
        <p style={{ margin: "0 0 8px" }}>
          <Link href="/support" style={{ color: "var(--accent)", fontWeight: 600 }}>← Quay lại Hỗ trợ</Link>
        </p>
        <h1 className="page-title" style={{ marginBottom: 4 }}>{t.subject}</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          {t.code}
          {t.orderCode ? ` · Đơn ${t.orderCode}` : ""} · Trạng thái:{" "}
          <b style={{ color: STATUS_COLOR[t.status] ?? "#333" }}>{TICKET_STATUS_LABEL[t.status] ?? t.status}</b>
        </p>
        {msg && <div className="form-ok">{msg}</div>}
        {err && <div className="form-err">{err}</div>}

        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {t.messages.map((m) => (
            <div
              key={m.id}
              className="step"
              style={m.fromStaff ? { borderColor: "var(--accent)", background: "var(--accent-soft)" } : undefined}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <b>{m.fromStaff ? "Đội hỗ trợ" : "Bạn"}</b>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  {m.createdAt.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}
                </span>
              </div>
              <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{m.body}</p>
            </div>
          ))}
        </div>

        {!closed ? (
          <>
            <form action={replyTicketAction} className="step" style={{ display: "grid", gap: 12, marginTop: 18 }}>
              <input type="hidden" name="code" value={t.code} />
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="tk-reply">Trả lời thêm</label>
                <textarea id="tk-reply" name="body" required maxLength={4000} rows={4} placeholder="Nhập nội dung trả lời..." style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: "11px 13px", fontFamily: "inherit", fontSize: 15, resize: "vertical" }} />
              </div>
              <div>
                <button className="btn btn-primary" type="submit">Gửi trả lời</button>
              </div>
            </form>
            <form action={closeTicketAction} style={{ marginTop: 14 }}>
              <input type="hidden" name="code" value={t.code} />
              <button className="btn btn-ghost btn-sm" type="submit">Đóng ticket (đã xử lý xong)</button>
            </form>
          </>
        ) : (
          <div className="step" style={{ marginTop: 18 }}>
            <p style={{ margin: 0 }}>Ticket này đã đóng. Nếu vẫn cần hỗ trợ, hãy <Link href="/support" style={{ fontWeight: 700, color: "var(--accent)" }}>tạo ticket mới</Link>.</p>
          </div>
        )}
      </div>
    </main>
  );
}
