import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { creatorBalances, creatorStats, getCreatorByUser, releaseDueCommissions } from "@/lib/creator";
import { fmtMoney } from "@/lib/moneyfmt";
import { getPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function CreatorDashboard() {
  const { cur, lang } = await getPrefs();
  const fmt = (c: number) => fmtMoney(c, cur, lang);
  const user = (await getCurrentUser())!;
  const creator = (await getCreatorByUser(user.id))!;
  await releaseDueCommissions(creator.id);
  const [bal, stats30, stats7] = await Promise.all([
    creatorBalances(creator.id),
    creatorStats(creator.id, 30),
    creatorStats(creator.id, 7),
  ]);
  const coupons = await prisma.discountCode.count({ where: { creatorId: creator.id, active: true } });
  const levels = await prisma.creatorLevel.findMany({ orderBy: { minRevenue30dCents: "asc" } });
  const nextLevel = levels.find((l) => l.minRevenue30dCents > (creator.level?.minRevenue30dCents ?? 0)) ?? null;
  const progressPct = nextLevel ? Math.min(100, Math.round((stats30.revenueCents / Math.max(1, nextLevel.minRevenue30dCents)) * 100)) : 100;
  const effRate = ((creator.customRateBps ?? creator.level?.rateBps ?? 0) / 100).toFixed(2).replace(/\.?0+$/, "");

  const days: Array<{ label: string; revenue: number }> = [];
  const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - 29);
  const comms = await prisma.creatorCommission.findMany({
    where: { creatorId: creator.id, status: { not: "REVERSED" }, createdAt: { gte: since } },
    select: { eligibleCents: true, createdAt: true },
  });
  for (let i = 0; i < 30; i++) {
    const d = new Date(since); d.setDate(d.getDate() + i);
    const key = d.toDateString();
    days.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, revenue: comms.filter((c) => c.createdAt.toDateString() === key).reduce((a, c) => a + c.eligibleCents, 0) });
  }
  const maxRev = Math.max(1, ...days.map((d) => d.revenue));

  const recent = await prisma.creatorCommission.findMany({
    where: { creatorId: creator.id },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { order: { select: { code: true, totalCents: true, status: true, game: { select: { name: true } } } } },
  });
  const byGame = new Map<string, { orders: number; revenue: number; commission: number }>();
  const all = await prisma.creatorCommission.findMany({
    where: { creatorId: creator.id, status: { not: "REVERSED" } },
    select: { eligibleCents: true, amountCents: true, order: { select: { game: { select: { name: true } } } } },
  });
  for (const c of all) {
    const k = c.order.game.name;
    const cur = byGame.get(k) ?? { orders: 0, revenue: 0, commission: 0 };
    cur.orders++; cur.revenue += c.eligibleCents; cur.commission += c.amountCents;
    byGame.set(k, cur);
  }
  const top = [...byGame.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);

  const ic = (path: React.ReactNode) => <span className="ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{path}</svg></span>;
  return (
    <div>
      <div className="crt-top">
        <div className="crt-bal">
          <div className="k">Số dư có thể rút</div>
          <div className="v">{fmt(bal.availableCents)}</div>
          <div className="sub">
            <div><b>{fmt(bal.pendingCents)}</b><span>Hoa hồng đang chờ</span></div>
            <div><b>{fmt(bal.paidOutCents)}</b><span>Đã thanh toán</span></div>
            <div><b>{coupons}</b><span>Mã giảm đang chạy</span></div>
          </div>
          <a className="btn" href="/creator/payouts">Rút tiền</a>
        </div>
        <div className="crt-lvl">
          <div className="k">Cấp Affiliate hiện tại</div>
          <div className="v">{creator.level?.name ?? "Starter"} · hoa hồng {effRate}%</div>
          {nextLevel ? (
            <>
              <div className="crt-prog"><i style={{ width: `${progressPct}%` }} /></div>
              <p style={{ margin: 0, fontSize: 13.5, color: "#64748B" }}>
                Doanh thu 30 ngày {fmt(stats30.revenueCents)} — còn {fmt(Math.max(0, nextLevel.minRevenue30dCents - stats30.revenueCents))} nữa để lên cấp <strong style={{ color: "#12233F" }}>{nextLevel.name}</strong> ({nextLevel.rateBps / 100}%).
              </p>
            </>
          ) : (
            <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "#64748B" }}>Bạn đang ở cấp cao nhất của chương trình. Doanh thu 30 ngày: {fmt(stats30.revenueCents)}.</p>
          )}
        </div>
      </div>

      <div className="crt-stats">
        <div className="crt-stat"><div className="k">{ic(<><path d="M3 3v18h18" /><path d="M8 17v-6M13 17V7M18 17v-9" /></>)}Doanh thu 30 ngày</div><div className="v">{fmt(stats30.revenueCents)}</div></div>
        <div className="crt-stat"><div className="k">{ic(<><path d="M5 8h14l-1.1 12.1A2 2 0 0 1 15.9 22H8.1a2 2 0 0 1-2-1.9Z" /><path d="M8.5 10.5V6.5a3.5 3.5 0 0 1 7 0v4" /></>)}Đơn hàng 30 ngày</div><div className="v">{stats30.orders}</div></div>
        <div className="crt-stat"><div className="k">{ic(<path d="m4 3 7.6 18 2.3-7.4 7.1-2.1Z" />)}Lượt click 30 ngày</div><div className="v">{stats30.clicks}</div></div>
        <div className="crt-stat"><div className="k">{ic(<><circle cx="7" cy="7" r="2.4" /><circle cx="17" cy="17" r="2.4" /><path d="M18 6 6 18" /></>)}Tỉ lệ chuyển đổi</div><div className="v">{stats30.conversionRate.toFixed(1)}%</div></div>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "2px 0 0" }}>7 ngày gần nhất: {stats7.orders} đơn · {stats7.clicks} click · doanh thu {fmt(stats7.revenueCents)} · hoa hồng {fmt(stats7.commissionCents)}.</p>

      <div className="crt-card" style={{ marginTop: 16 }}>
        <h3>Doanh thu theo ngày (30 ngày)</h3>
        <div className="crt-bars">
          {days.map((d, i) => (
            <div key={i} className="bar" style={{ height: `${Math.max(3, (d.revenue / maxRev) * 100)}%` }} title={`${d.label}: ${fmt(d.revenue)}`} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
          <span>{days[0]?.label}</span><span>{days[29]?.label}</span>
        </div>
      </div>

      <div className="crt-cols">
      <div>
      <h3 className="crt-sec-title">Đơn hàng gần nhất</h3>
      {recent.length === 0 ? (
        <div className="crt-card"><p>Chưa có đơn hàng nào từ link của bạn. Chia sẻ đường dẫn affiliate để bắt đầu nhận hoa hồng.</p></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="crt-table">
            <thead><tr><th>Đơn</th><th>Sản phẩm</th><th>Ngày</th><th>Giá trị đơn</th><th>Hoa hồng</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id}>
                  <td>{c.orderCode}</td>
                  <td>{c.order.game.name}</td>
                  <td>{c.createdAt.toLocaleDateString("vi-VN")}</td>
                  <td>{fmt(c.order.totalCents)}</td>
                  <td><strong>{fmt(c.amountCents)}</strong></td>
                  <td><span className={`crt-badge ${c.status === "PAID" || c.status === "AVAILABLE" ? "green" : c.status === "REVERSED" ? "red" : "gray"}`}>{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      </div>
      <div>
      {top.length > 0 && (
        <>
          <h3 className="crt-sec-title">Sản phẩm hiệu quả nhất</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="crt-table">
              <thead><tr><th>Sản phẩm</th><th>Đơn</th><th>Doanh thu</th><th>Hoa hồng</th></tr></thead>
              <tbody>
                {top.map(([name, v]) => (
                  <tr key={name}><td>{name}</td><td>{v.orders}</td><td>{fmt(v.revenue)}</td><td><strong>{fmt(v.commission)}</strong></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      </div>
      </div>
    </div>
  );
}
