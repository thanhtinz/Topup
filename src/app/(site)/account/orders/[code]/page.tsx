import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPrefs } from "@/lib/prefs";
import { fmtMoney } from "@/lib/moneyfmt";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ xử lý",
  PROCESSING: "Đang xử lý",
  PARTIAL: "Đã giao một phần",
  DELIVERED: "Đã giao thành công",
  FAILED: "Thất bại",
  REFUNDED: "Đã hoàn tiền",
  CANCELLED: "Đã hủy",
};

type Step = { label: string; at: Date | null; state: "done" | "on" | "bad" | "" ; note?: string };

export default async function OrderTrackingPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  const prefs = await getPrefs();
  const { code } = await params;
  const order = await prisma.order.findFirst({
    where: { code: code.toUpperCase(), userId: user.id },
    include: { game: { select: { name: true, slug: true, cover: true } }, items: { include: { package: { select: { name: true } } } }, review: { select: { id: true } } },
  });
  if (!order) notFound();

  const steps: Step[] = [
    { label: "Đã đặt hàng", at: order.createdAt, state: "done", note: `Mã đơn ${order.code}` },
  ];
  if (order.status === "PENDING" || order.status === "PROCESSING") {
    steps.push({ label: "Đang xử lý", at: order.updatedAt, state: "on", note: "Đơn đang được nạp vào tài khoản game của bạn" });
  } else if (order.status === "PARTIAL") {
    steps.push({ label: "Đang xử lý", at: order.updatedAt, state: "done" });
    steps.push({ label: "Đã giao một phần", at: order.updatedAt, state: "on", note: "Một phần gói đã nạp thành công, phần còn lại đang được xử lý tiếp" });
  } else if (order.status === "DELIVERED") {
    steps.push({ label: "Đang xử lý", at: order.updatedAt, state: "done" });
    steps.push({ label: "Đã giao thành công", at: order.updatedAt, state: "done", note: "Tiền tệ/vật phẩm đã vào tài khoản game của bạn" });
  } else if (order.status === "FAILED") {
    steps.push({ label: "Xử lý thất bại", at: order.updatedAt, state: "bad", note: "Đơn không nạp được — số tiền sẽ được xử lý theo chính sách hoàn tiền" });
  } else if (order.status === "REFUNDED") {
    steps.push({ label: "Đã hoàn tiền về ví", at: order.updatedAt, state: "bad", note: "Số tiền của đơn đã hoàn về ví BNTGame của bạn" });
  } else if (order.status === "CANCELLED") {
    steps.push({ label: "Đơn đã hủy", at: order.updatedAt, state: "bad" });
  }

  return (
    <main className="bsx">
      <div className="container" style={{ maxWidth: 760, paddingTop: 28, paddingBottom: 52 }}>
        <p style={{ marginBottom: 10 }}><Link href="/account/orders" style={{ fontWeight: 600 }}>← Tất cả đơn hàng</Link></p>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          {order.game.cover ? <img src={order.game.cover} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover" }} referrerPolicy="no-referrer" /> : null}
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 22 }}>{order.game.name}</h1>
            <span className="muted">Mã đơn {order.code} · {order.createdAt.toLocaleString("vi-VN")}</span>
          </div>
          <span className={`crt-badge ${order.status === "DELIVERED" ? "green" : order.status === "REFUNDED" || order.status === "FAILED" ? "red" : "amber"}`} style={{ fontSize: 13.5 }}>
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>

        <div className="crt-card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginBottom: 8 }}>Tiến trình đơn hàng</h3>
          <div className="tl">
            {steps.map((s, i) => (
              <div key={i} className={`tl-step ${s.state}`}>
                <b>{s.label}</b>
                {s.at && <span>{s.at.toLocaleString("vi-VN")}</span>}
                {s.note && <span style={{ display: "block" }}>{s.note}</span>}
              </div>
            ))}
          </div>
          {order.note && <p className="muted" style={{ marginTop: 4 }}>Ghi chú: {order.note}</p>}
        </div>

        <div className="crt-card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginBottom: 10 }}>Chi tiết gói đã mua</h3>
          {order.items.map((it) => {
            const fields = (it.fieldsJson && typeof it.fieldsJson === "object" ? (it.fieldsJson as Record<string, string>) : {});
            return (
              <div key={it.id} style={{ padding: "8px 0", borderTop: "1px solid #EEF3F9" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong>{it.package.name} × {it.qty}</strong>
                  <span>{fmtMoney(it.priceCents * it.qty, prefs.cur, prefs.lang)}</span>
                </div>
                {Object.entries(fields).filter(([, v]) => v).map(([k, v]) => (
                  <span key={k} className="muted" style={{ display: "block", fontSize: 13.5 }}>{k}: {v}</span>
                ))}
                <span className="muted" style={{ fontSize: 13 }}>Trạng thái gói: {STATUS_LABEL[it.status] ?? it.status}</span>
              </div>
            );
          })}
          <div style={{ borderTop: "1px solid #E6EDF6", marginTop: 10, paddingTop: 10, display: "flex", flexDirection: "column", gap: 4, fontSize: 14.5 }}>
            {order.discountCents > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Giảm mã khuyến mãi{order.promoCode ? ` (${order.promoCode})` : ""}</span><span>-{fmtMoney(order.discountCents, prefs.cur, prefs.lang)}</span></div>}
            {order.vipDiscountCents > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Giảm VIP {order.vipTierName ?? ""}</span><span>-{fmtMoney(order.vipDiscountCents, prefs.cur, prefs.lang)}</span></div>}
            {order.pointsUsed > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Dùng điểm</span><span>-{fmtMoney(order.pointsUsed, prefs.cur, prefs.lang)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16 }}><span>Tổng thanh toán từ ví</span><span>{fmtMoney(order.totalCents, prefs.cur, prefs.lang)}</span></div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn btn-primary" href={`/game/${order.game.slug}?quick=1`}>Nạp lại gói này</Link>
          {order.status === "DELIVERED" && !order.review && <Link className="btn btn-outline" href={`/game/${order.game.slug}`}>Đánh giá game</Link>}
          <Link className="btn btn-outline" href="/support">Cần hỗ trợ về đơn này</Link>
        </div>
      </div>
    </main>
  );
}
