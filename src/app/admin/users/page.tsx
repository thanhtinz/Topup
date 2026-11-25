import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";
import { Top, Msg } from "../ui";
import { adjustBalanceAction, toggleUserAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; q?: string }> }) {
  const { msg, err, q } = await searchParams;
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div>
      <Top title="Khách hàng & ví" />
      <Msg msg={msg} err={err} />
      <form method="get" style={{ marginBottom: 16 }}>
        <div className="search" style={{ maxWidth: 420 }}>
          <input name="q" placeholder="Tìm theo email / tên…" defaultValue={q ?? ""} style={{ flex: 1, border: 0, height: "100%", fontFamily: "inherit", fontSize: 15 }} />
        </div>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Khách</th><th>Vai trò</th><th>Số dư ví</th><th>Trạng thái</th><th>Cộng / trừ ví (USD)</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name}</b><div className="muted">{u.email}</div></td>
                <td>{u.role}</td>
                <td>{fmtUSD(u.balanceCents)}</td>
                <td><span className={`badge ${u.active ? "green" : "red"}`}>{u.active ? "Hoạt động" : "Đã khoá"}</span></td>
                <td>
                  <span style={{ display: "inline-flex", gap: 6 }}>
                    <form action={adjustBalanceAction} style={{ display: "flex", gap: 6 }}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="kind" value="add" />
                      <input name="amount" type="number" step="0.01" min="0.01" required style={{ width: 90, height: 36, borderRadius: 10, border: "1px solid var(--line)", padding: "0 8px", fontFamily: "inherit" }} />
                      <button className="btn btn-primary btn-sm" type="submit">Cộng</button>
                    </form>
                    <form action={adjustBalanceAction} style={{ display: "flex", gap: 6 }}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="kind" value="subtract" />
                      <input name="amount" type="number" step="0.01" min="0.01" required style={{ width: 90, height: 36, borderRadius: 10, border: "1px solid var(--line)", padding: "0 8px", fontFamily: "inherit" }} />
                      <button className="btn btn-danger btn-sm" type="submit">Trừ</button>
                    </form>
                  </span>
                </td>
                <td>
                  {u.role !== "ADMIN" && (
                    <form action={toggleUserAction} className="inline-form">
                      <input type="hidden" name="id" value={u.id} />
                      <button className="btn btn-ghost btn-sm" type="submit">{u.active ? "Khoá" : "Mở"}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 12 }}>Nút Cộng/Trừ gửi kind rõ ràng theo từng nút; kind lạ hoặc trống bị chặn ở máy chủ, không mặc định cộng.</p>
    </div>
  );
}
