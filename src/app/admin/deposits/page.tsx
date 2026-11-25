import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";
import { Top, Msg } from "../ui";
import { decideDepositAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminDeposits({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const deposits = await prisma.depositRequest.findMany({
    include: { user: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  return (
    <div>
      <Top title="Duyệt nạp tiền" />
      <Msg msg={msg} err={err} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Mã lệnh</th><th>Khách</th><th>Số tiền</th><th>Cổng</th><th>Trạng thái</th><th>Thời gian</th><th>Thao tác</th></tr></thead>
          <tbody>
            {deposits.map((d) => (
              <tr key={d.id}>
                <td><b>{d.code}</b></td>
                <td>{d.user.email}</td>
                <td>{fmtUSD(d.amountCents)}</td>
                <td>{d.method}</td>
                <td><span className={`badge ${d.status === "APPROVED" ? "green" : d.status === "REJECTED" ? "red" : ""}`}>{d.status}</span></td>
                <td>{d.createdAt.toLocaleString("vi-VN")}</td>
                <td>
                  {d.status === "PENDING" && (
                    <span style={{ display: "inline-flex", gap: 6 }}>
                      <form action={decideDepositAction} className="inline-form">
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="kind" value="approve" />
                        <button className="btn btn-primary btn-sm" type="submit">Duyệt + cộng</button>
                      </form>
                      <form action={decideDepositAction} className="inline-form">
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="kind" value="reject" />
                        <button className="btn btn-danger btn-sm" type="submit">Từ chối</button>
                      </form>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {!deposits.length && <tr><td colSpan={7} className="muted">Chưa có lệnh nạp nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
