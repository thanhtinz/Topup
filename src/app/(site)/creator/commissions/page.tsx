import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { creatorBalances, getCreatorByUser, releaseDueCommissions } from "@/lib/creator";
import { fmtMoney } from "@/lib/moneyfmt";
import { getPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { PENDING: "Chờ xác nhận", AVAILABLE: "Có thể rút", PAID: "Đã trả", REVERSED: "Đã thu hồi" };

export default async function CreatorCommissions({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const { status, page } = await searchParams;
  const { cur, lang } = await getPrefs();
  const fmt = (c: number) => fmtMoney(c, cur, lang);
  const user = (await getCurrentUser())!;
  const creator = (await getCreatorByUser(user.id))!;
  await releaseDueCommissions(creator.id);
  const bal = await creatorBalances(creator.id);
  const p = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const where = { creatorId: creator.id, ...(status && LABEL[status] ? { status } : {}) };
  const [total, rows] = await Promise.all([
    prisma.creatorCommission.count({ where }),
    prisma.creatorCommission.findMany({ where, orderBy: { createdAt: "desc" }, skip: (p - 1) * 20, take: 20, include: { order: { select: { game: { select: { name: true } } } } } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / 20));
  return (
    <div>
      <div className="crt-stats">
        <div className="crt-stat"><div className="k">Chờ xác nhận</div><div className="v">{fmt(bal.pendingCents)}</div></div>
        <div className="crt-stat"><div className="k">Có thể rút</div><div className="v" style={{ color: "var(--accent)" }}>{fmt(bal.availableCents)}</div></div>
        <div className="crt-stat"><div className="k">Đang khoá (yêu cầu rút)</div><div className="v">{fmt(bal.lockedCents)}</div></div>
        <div className="crt-stat"><div className="k">Đã nhận qua rút tiền</div><div className="v">{fmt(bal.paidOutCents)}</div></div>
      </div>
      <div className="crt-nav" style={{ marginTop: 4 }}>
        <Link href="/creator/commissions" className={!status ? "on" : ""}>Tất cả</Link>
        {Object.entries(LABEL).map(([k, v]) => (
          <Link key={k} href={`/creator/commissions?status=${k}`} className={status === k ? "on" : ""}>{v}</Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="crt-card"><p>Chưa có khoản hoa hồng nào ở mục này.</p></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="crt-table">
            <thead><tr><th>Đơn</th><th>Sản phẩm</th><th>Ngày</th><th>Doanh thu tính</th><th>Tỉ lệ</th><th>Hoa hồng</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.orderCode}</td>
                  <td>{c.order.game.name}</td>
                  <td>{c.createdAt.toLocaleDateString("vi-VN")}</td>
                  <td>{fmt(c.eligibleCents)}</td>
                  <td>{(c.rateBps / 100).toFixed(2).replace(/\.?0+$/, "")}%</td>
                  <td><strong>{fmt(c.amountCents)}</strong></td>
                  <td><span className={`crt-badge ${c.status === "AVAILABLE" || c.status === "PAID" ? "green" : c.status === "REVERSED" ? "red" : "gray"}`}>{LABEL[c.status] ?? c.status}</span>{c.status === "PENDING" && <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>Khả dụng {c.availableAt.toLocaleDateString("vi-VN")}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {Array.from({ length: pages }, (_, i) => (
            <Link key={i} href={`/creator/commissions?${status ? `status=${status}&` : ""}page=${i + 1}`} className={`btn btn-sm ${p === i + 1 ? "btn-primary" : "btn-outline"}`}>{i + 1}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
