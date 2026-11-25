import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";
import { Top, Msg } from "../ui";
import { setOrderStatusAction, refundOrderAction } from "../actions";

export const dynamic = "force-dynamic";
const STATUSES = ["PENDING", "PROCESSING", "PARTIAL", "DELIVERED", "FAILED", "REFUNDED", "CANCELLED"];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; status?: string; q?: string }> }) {
  const { msg, err, status, q } = await searchParams;
  const orders = await prisma.order.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" as const } }, { user: { email: { contains: q, mode: "insensitive" as const } } }, { game: { name: { contains: q, mode: "insensitive" as const } } }] } : {}),
    },
    include: { game: true, user: true, items: { include: { package: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div>
      <Top title="Đơn nạp" />
      <Msg msg={msg} err={err} />
      <form method="get" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <select name="status" defaultValue={status ?? ""} style={{ height: 44, borderRadius: 14, border: "1px solid var(--line)", padding: "0 12px", fontFamily: "inherit" }}>
          <option value="">Mọi trạng thái</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-outline btn-sm" type="submit">Lọc</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Mã</th><th>Khách</th><th>Game / Gói</th><th>Trường nạp</th><th>Tổng</th><th>Trạng thái</th><th>Đổi trạng thái</th><th>Hoàn</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><b>{o.code}</b>{o.note && <div className="muted" style={{ whiteSpace: "normal", maxWidth: 220 }}>{o.note}</div>}</td>
                <td>{o.user.email}</td>
                <td>{o.game.name}<div className="muted">{o.items.map((i) => `${i.package.name} ×${i.qty}`).join(", ")}</div></td>
                <td style={{ whiteSpace: "normal", maxWidth: 200 }}>{o.items.map((i) => JSON.stringify(i.fieldsJson)).join(" ")}</td>
                <td>{fmtUSD(o.totalCents)}</td>
                <td><span className="badge">{o.status}</span></td>
                <td>
                  <form action={setOrderStatusAction} style={{ display: "flex", gap: 6 }}>
                    <input type="hidden" name="id" value={o.id} />
                    <select name="status" defaultValue={o.status} style={{ height: 36, borderRadius: 10, border: "1px solid var(--line)", fontFamily: "inherit" }}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button className="btn btn-ghost btn-sm" type="submit">Lưu</button>
                  </form>
                </td>
                <td>
                  {o.status !== "REFUNDED" && o.status !== "DELIVERED" && (
                    <form action={refundOrderAction} className="inline-form">
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="kind" value="refund" />
                      <button className="btn btn-danger btn-sm" type="submit">Hoàn ví</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!orders.length && <tr><td colSpan={8} className="muted">Chưa có đơn nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
