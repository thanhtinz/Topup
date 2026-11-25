import Link from "next/link";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../../../ui";
import { decidePayoutAction } from "../actions";
import { fmtUSD } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminCreatorPayouts({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const rows = await prisma.creatorPayout.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 60,
    include: { creator: { select: { id: true, displayName: true, code: true } } },
  });
  const open = rows.filter((p) => ["PENDING", "APPROVED", "PROCESSING"].includes(p.status));
  const done = rows.filter((p) => !["PENDING", "APPROVED", "PROCESSING"].includes(p.status));
  const renderRow = (p: (typeof rows)[number]) => (
    <tr key={p.id}>
      <td><Link href={`/admin/partnership/affiliate/${p.creator.id}`}>{p.creator.displayName}</Link> <span className="muted">({p.creator.code})</span><br /><span className="muted">{p.createdAt.toLocaleString("vi-VN")}</span></td>
      <td><strong>{fmtUSD(p.amountCents)}</strong></td>
      <td>{p.method}<br /><span className="muted">{p.destination}</span></td>
      <td>{p.status}{p.txRef && <><br /><span className="muted">Tx: {p.txRef}</span></>}</td>
      <td style={{ minWidth: 320 }}>
        {["PENDING", "APPROVED", "PROCESSING"].includes(p.status) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {p.status === "PENDING" && (
                <form action={decidePayoutAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="kind" value="approve" />
                  <button className="btn btn-dark btn-sm" type="submit">Duyệt</button>
                </form>
              )}
              {p.status === "APPROVED" && (
                <form action={decidePayoutAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="kind" value="process" />
                  <button className="btn btn-outline btn-sm" type="submit">Đánh dấu đang xử lý</button>
                </form>
              )}
            </div>
            <form action={decidePayoutAction} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="kind" value="paid" />
              <input name="txRef" placeholder="Mã giao dịch" style={{ flex: "1 1 130px" }} />
              <button className="btn btn-dark btn-sm" type="submit">Đã trả</button>
            </form>
            <form action={decidePayoutAction} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="kind" value="reject" />
              <input name="reviewNote" placeholder="Lý do từ chối" style={{ flex: "1 1 130px" }} />
              <button className="btn btn-outline btn-sm" type="submit" style={{ color: "#B3261E" }}>Từ chối</button>
            </form>
          </div>
        )}
      </td>
    </tr>
  );
  return (
    <div>
      <Top title="Affiliate — Rút tiền" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <h2>Hàng đợi xử lý ({open.length})</h2>
        {open.length === 0 ? <p className="muted">Không có yêu cầu nào đang chờ.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Affiliate</th><th>Số tiền</th><th>Phương thức / đích</th><th>Trạng thái</th><th>Xử lý</th></tr></thead>
            <tbody>{open.map(renderRow)}</tbody>
          </table></div>
        )}
      </div>
      {done.length > 0 && (
        <div className="admin-card">
          <h2>Đã xử lý</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Affiliate</th><th>Số tiền</th><th>Phương thức / đích</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>{done.map(renderRow)}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
