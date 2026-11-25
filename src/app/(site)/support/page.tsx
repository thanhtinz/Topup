import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createTicketAction } from "@/app/actions";
import { TICKET_STATUS_LABEL } from "@/lib/tickets";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  OPEN: "#B45309",
  ANSWERED: "#15803D",
  CLOSED: "#6B7280",
};

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const s = await getSettings();
  const user = await getCurrentUser();
  const items = (s.support_faq ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("|");
      return i > 0 ? { q: l.slice(0, i).trim(), a: l.slice(i + 1).trim() } : { q: l, a: "" };
    })
    .filter((x) => x.q);
  const myTickets = user
    ? await prisma.ticket.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 10,
        include: { _count: { select: { messages: true } } },
      })
    : [];
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 760 }}>
        <h1 className="page-title">Hỗ trợ</h1>
        {msg && <div className="form-ok">{msg}</div>}
        {err && <div className="form-err">{err}</div>}
        <div className="steps" style={{ gridTemplateColumns: "1fr" }}>
          {items.map((it, i) => (
            <div className="step" key={i}>
              <h3>{it.q}</h3>
              {it.a && <p>{it.a}</p>}
            </div>
          ))}
        </div>

        <h2 style={{ margin: "34px 0 6px", fontSize: 22 }}>Gửi yêu cầu hỗ trợ (ticket)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Chưa tìm thấy câu trả lời? Gửi ticket để đội hỗ trợ xử lý riêng cho tài khoản của bạn — trả lời sẽ hiện ngay tại đây và trong chuông thông báo.
        </p>
        {user ? (
          <>
            <form action={createTicketAction} className="step" style={{ display: "grid", gap: 12, marginTop: 14 }}>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="tk-subject">Chủ đề *</label>
                <input id="tk-subject" name="subject" required maxLength={120} placeholder="Ví dụ: Đơn nạp chưa nhận được" />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="tk-order">Mã đơn hàng liên quan (nếu có)</label>
                <input id="tk-order" name="orderCode" maxLength={40} placeholder="Ví dụ: NAP123456" />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="tk-body">Nội dung *</label>
                <textarea id="tk-body" name="body" required maxLength={4000} rows={5} placeholder="Mô tả chi tiết vấn đề bạn gặp phải..." style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: "11px 13px", fontFamily: "inherit", fontSize: 15, resize: "vertical" }} />
              </div>
              <div>
                <button className="btn btn-primary" type="submit">Gửi ticket</button>
              </div>
            </form>

            {myTickets.length > 0 && (
              <>
                <h3 style={{ margin: "28px 0 10px", fontSize: 17 }}>Ticket của tôi</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  {myTickets.map((t) => (
                    <Link key={t.id} href={`/account/tickets/${t.code}`} className="step" style={{ display: "block", color: "inherit" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <b>{t.subject}</b>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: STATUS_COLOR[t.status] ?? "#333" }}>{TICKET_STATUS_LABEL[t.status] ?? t.status}</span>
                      </div>
                      <p style={{ margin: "5px 0 0" }}>
                        {t.code}
                        {t.orderCode ? ` · Đơn ${t.orderCode}` : ""} · {t._count.messages} tin nhắn · Cập nhật {t.updatedAt.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}
                      </p>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="step" style={{ marginTop: 14 }}>
            <p style={{ margin: 0 }}>
              <Link href="/?auth=login&next=/support" style={{ fontWeight: 700, color: "var(--accent)" }}>Đăng nhập</Link> để gửi ticket hỗ trợ và theo dõi trả lời. Các kênh liên hệ nhanh ở góc phải dưới màn hình vẫn dùng được không cần đăng nhập.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
