import Link from "next/link";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../../../ui";
import { decideCommissionAction } from "../actions";
import { releaseDueCommissions } from "@/lib/creator";
import { fmtUSD } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminCreatorCommissions({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; status?: string; creator?: string }> }) {
  const { msg, err, status, creator } = await searchParams;
  await releaseDueCommissions();
  const where = {
    ...(status ? { status } : {}),
    ...(creator ? { creatorId: Number(creator) } : {}),
  };
  const rows = await prisma.creatorCommission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { creator: { select: { id: true, displayName: true, code: true } } },
  });
  const totals = await prisma.creatorCommission.groupBy({ by: ["status"], where: { status: { not: "REVERSED" } }, _sum: { amountCents: true } });
  return (
    <div>
      <Top title="Affiliate — Hoa hồng" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <p className="muted" style={{ marginBottom: 12 }}>
          Tổng theo trạng thái: {totals.map((t) => `${t.status}: ${fmtUSD(t._sum.amountCents ?? 0)}`).join(" · ")}. Thu hồi khoản đã PAID sẽ tự tạo điều chỉnh âm trừ vào số dư khả dụng của Affiliate.
        </p>
        <form method="get" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <select name="status" defaultValue={status ?? ""}>
            <option value="">Mọi trạng thái</option>
            {["PENDING", "AVAILABLE", "PAID", "REVERSED"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-dark btn-sm" type="submit">Lọc</button>
        </form>
        {rows.length === 0 ? <p className="muted">Không có khoản hoa hồng nào.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Đơn</th><th>Affiliate</th><th>Ngày</th><th>Doanh thu tính</th><th>Tỉ lệ</th><th>Hoa hồng</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>{c.orderCode}</td>
                    <td><Link href={`/admin/partnership/affiliate/${c.creator.id}`}>{c.creator.displayName}</Link> <span className="muted">({c.creator.code})</span></td>
                    <td>{c.createdAt.toLocaleDateString("vi-VN")}</td>
                    <td>{fmtUSD(c.eligibleCents)}</td>
                    <td>{(c.rateBps / 100).toFixed(2)}%</td>
                    <td><strong>{fmtUSD(c.amountCents)}</strong></td>
                    <td>{c.status}{c.status === "PENDING" && <><br /><span className="muted">khả dụng {c.availableAt.toLocaleDateString("vi-VN")}</span></>}</td>
                    <td>
                      {c.status !== "REVERSED" ? (
                        <form action={decideCommissionAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="kind" value="reverse" /><button className="btn btn-outline btn-sm" type="submit">Thu hồi</button></form>
                      ) : (
                        <form action={decideCommissionAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="kind" value="restore" /><button className="btn btn-outline btn-sm" type="submit">Khôi phục</button></form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
