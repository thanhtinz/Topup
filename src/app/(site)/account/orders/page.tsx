import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";
import { orderGroup } from "@/lib/order-groups";
import { pointsConfig } from "@/lib/points";
import RateForm from "./RateForm";
import OrderCard, { type OrderCardData } from "./OrderCard";

export const dynamic = "force-dynamic";

const PER = 20;

const STATUS_VI: Record<string, string> = {
  PENDING: "Chờ xử lý",
  PROCESSING: "Đang xử lý",
  PARTIAL: "Giao một phần",
  DELIVERED: "Đã giao",
  FAILED: "Thất bại",
  REFUNDED: "Đã hoàn tiền",
  CANCELLED: "Đã huỷ",
};

const ST: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: "#FEF3C7", fg: "#92400E" },
  PROCESSING: { bg: "#EFF6FF", fg: "#1D4ED8" },
  PARTIAL: { bg: "#FEF3C7", fg: "#92400E" },
  DELIVERED: { bg: "#ECFDF5", fg: "#047857" },
  FAILED: { bg: "#FEF2F2", fg: "#B91C1C" },
  REFUNDED: { bg: "#F1F5F9", fg: "#475569" },
  CANCELLED: { bg: "#F1F5F9", fg: "#475569" },
};

const statTile = (d: string) => (
  <span style={{ width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#0B63E5,#1FB6F2)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 14px rgba(11,99,229,.28)" }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
  </span>
);

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ g?: string; q?: string; status?: string; from?: string; to?: string; page?: string; msg?: string; err?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const gObj = orderGroup(sp.g);
  const g = gObj?.key;
  const status = sp.status && STATUS_VI[sp.status] ? (sp.status as OrderStatus) : undefined;
  const q = (sp.q ?? "").trim();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to : undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const createdAt: { gte?: Date; lte?: Date } = {};
  if (from) createdAt.gte = new Date(`${from}T00:00:00`);
  if (to) createdAt.lte = new Date(`${to}T23:59:59`);
  const where = {
    userId: user.id,
    ...(status ? { status } : gObj ? { status: { in: [...gObj.statuses] as OrderStatus[] } } : {}),
    ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" as const } }, { game: { name: { contains: q, mode: "insensitive" as const } } }] } : {}),
    ...(from || to ? { createdAt } : {}),
  };

  const [statsAgg, count, orders] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where: { userId: user.id }, _count: { _all: true }, _sum: { totalCents: true } }),
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER,
      take: PER,
      include: {
        game: { select: { name: true, cover: true } },
        items: { include: { package: { select: { name: true, region: true, method: true } } } },
        review: { select: { stars: true, pointsAwarded: true } },
      },
    }),
  ]);

  let totalOrders = 0, delivered = 0, waiting = 0, spent = 0;
  for (const row of statsAgg) {
    totalOrders += row._count._all;
    if (row.status === "DELIVERED") delivered += row._count._all;
    if (row.status === "PENDING" || row.status === "PROCESSING" || row.status === "PARTIAL") waiting += row._count._all;
    if (row.status !== "REFUNDED" && row.status !== "CANCELLED") spent += row._sum.totalCents ?? 0;
  }

  const pages = Math.max(1, Math.ceil(count / PER));
  const pcfg = await pointsConfig();
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = { g, q: q || undefined, status, from, to, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/account/orders?${p.toString()}`;
  };
  const stats = [
    { label: "Tổng số đơn", value: String(totalOrders), icon: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" },
    { label: "Đã giao", value: String(delivered), icon: "M20 6 9 17l-5-5" },
    { label: "Chờ xử lý", value: String(waiting), icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-14v6l4 2" },
    { label: "Tổng đã chi", value: fmtUSD(spent), icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-17v14M15 6.5c-.6-1-1.7-1.5-3-1.5-1.9 0-3.5 1.1-3.5 2.7 0 3.9 7 2 7 5.6 0 1.6-1.6 2.7-3.5 2.7-1.3 0-2.5-.6-3.1-1.6" },
  ];

  return (
    <main className="bsx">
      <div className="container" style={{ maxWidth: 880, paddingTop: 28, paddingBottom: 52 }}>
        <p className="crumb"><Link href="/account">← Hồ sơ</Link></p>
        <div style={{ borderRadius: 20, background: "#EFF6FE", border: "1px solid #BCD9FB", padding: "24px 26px" }}>
          <h1 className="bsx-h1" style={{ margin: 0 }}>Sản phẩm đã mua</h1>
          <p className="muted" style={{ margin: "5px 0 0", fontSize: 14 }}>Danh sách sản phẩm đã mua của bạn</p>
        </div>
        {sp.msg && <div className="form-ok">{sp.msg}</div>}
        {sp.err && <div className="form-err">{sp.err}</div>}

        <div className="ord-stats" style={{ marginTop: 18 }}>
          {stats.map((x) => (
            <div key={x.label} className="bsx-card" style={{ padding: "18px 18px 16px", borderTop: "3px solid #1FB6F2" }}>
              {statTile(x.icon)}
              <div style={{ marginTop: 12, fontSize: 11.5, fontWeight: 700, letterSpacing: ".07em", color: "#64748B", textTransform: "uppercase" }}>{x.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{x.value}</div>
            </div>
          ))}
        </div>

        <form className="bsx-card" method="get" style={{ marginTop: 18, padding: 22 }}>
          <div className="ord-filter">
            <div>
              <label className="bsx-flabel" htmlFor="oq">Tìm kiếm</label>
              <input id="oq" className="bsx-inp" name="q" defaultValue={q} placeholder="Mã đơn, tên sản phẩm" />
            </div>
            <div>
              <label className="bsx-flabel" htmlFor="ost">Trạng thái</label>
              <select id="ost" className="bsx-inp" name="status" defaultValue={status ?? ""}>
                <option value="">Tất cả</option>
                {Object.entries(STATUS_VI).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
            <div>
              <label className="bsx-flabel" htmlFor="ofr">Từ ngày</label>
              <input id="ofr" className="bsx-inp" type="date" name="from" defaultValue={from ?? ""} />
            </div>
            <div>
              <label className="bsx-flabel" htmlFor="oto">Đến ngày</label>
              <input id="oto" className="bsx-inp" type="date" name="to" defaultValue={to ?? ""} />
            </div>
          </div>
          {g && <input type="hidden" name="g" value={g} />}
          <button className="btn btn-primary" type="submit" style={{ marginTop: 16, background: "linear-gradient(120deg,#0A45B4,#1FB6F2)", padding: "11px 30px" }}>Lọc</button>
          {g && <p className="muted" style={{ margin: "12px 0 0", fontSize: 13 }}>Đang lọc theo nhóm từ Hồ sơ: <b>{gObj?.label}</b>. <Link href="/account/orders" style={{ color: "#0B63E5", fontWeight: 600 }}>Xem tất cả</Link></p>}
        </form>

        <p className="muted" style={{ margin: "20px 0 12px", fontSize: 13.5 }}>{count} đơn hàng</p>
        {orders.length ? (
          <div style={{ display: "grid", gap: 14 }}>
            {orders.map((o) => {
              const item = o.items[0];
              const st = ST[o.status] ?? ST.PENDING;
              const fields = Object.entries((item?.fieldsJson as Record<string, string>) ?? {}).filter(([, v]) => v);
              const savings: Array<[string, string]> = [];
              if (o.vipDiscountCents > 0) savings.push([`Giảm VIP ${o.vipTierName ?? ""}`.trim(), `−${fmtUSD(o.vipDiscountCents)}`]);
              if (o.discountCents > 0) savings.push([`Mã giảm ${o.promoCode ?? ""}`.trim(), `−${fmtUSD(o.discountCents)}`]);
              if (o.pointsUsed > 0) savings.push(["Điểm đã dùng", `${o.pointsUsed} điểm`]);
              const data: OrderCardData = {
                code: o.code ?? `#${o.id}`,
                statusLabel: STATUS_VI[o.status] ?? o.status,
                statusStyle: { background: st.bg, color: st.fg },
                total: fmtUSD(o.totalCents),
                cover: o.game.cover,
                gameName: o.game.name,
                pkgLine: item ? [item.package.name, item.package.region, item.package.method].filter(Boolean).join(" · ") : "",
                qty: item?.qty ?? 1,
                datetime: o.createdAt.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }),
                fields: fields as Array<[string, string]>,
                savings,
                note: o.note,
              };
              const reviewSlot = o.status === "DELIVERED" ? (
                o.review ? (
                  <p style={{ margin: "6px 0 0", color: "#D97706", fontWeight: 700 }}>
                    {"★".repeat(o.review.stars)}<span style={{ color: "#CBD5E1" }}>{"★".repeat(5 - o.review.stars)}</span>
                    <span className="muted" style={{ fontWeight: 500 }}>{o.review.pointsAwarded > 0 ? ` · +${o.review.pointsAwarded} điểm từ đánh giá này` : ""}</span>
                  </p>
                ) : (
                  <RateForm orderId={o.id} perReview={pcfg.perReview} />
                )
              ) : undefined;
              return <OrderCard key={o.id} data={data} reviewSlot={reviewSlot} />;
            })}
          </div>
        ) : (
          <div className="bsx-card" style={{ padding: "42px 20px", textAlign: "center" }}>
            <p style={{ margin: "0 0 6px", fontWeight: 800, color: "#0F172A", fontSize: 16.5 }}>Không có đơn nào khớp bộ lọc</p>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>Thử đổi từ khoá hoặc khoảng ngày. <Link href="/games" style={{ color: "#0B63E5", fontWeight: 700 }}>Xem game →</Link></p>
          </div>
        )}

        {pages > 1 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 22 }}>
            {page > 1 && <Link className="btn btn-ghost btn-sm" href={qs({ page: String(page - 1) })}>← Trước</Link>}
            <span className="btn btn-sm" style={{ pointerEvents: "none" }}>Trang {page}/{pages}</span>
            {page < pages && <Link className="btn btn-ghost btn-sm" href={qs({ page: String(page + 1) })}>Sau →</Link>}
          </div>
        )}
      </div>
    </main>
  );
}
