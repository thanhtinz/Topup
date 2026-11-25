import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";
import { pointsConfig, userTier, checkLateCompensation } from "@/lib/points";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  EARN_REVIEW: "Đánh giá đơn hàng",
  SPEND: "Dùng điểm thanh toán",
  REFUND_RETURN: "Hoàn điểm",
  LATE_COMP: "Bồi thường chậm trễ",
  ADMIN: "Điều chỉnh",
};

export default async function PointsPage() {
  const user = await requireUser();
  const cfg = await pointsConfig();
  if (cfg.enabled) {
    const { tier } = await userTier(user.id);
    await checkLateCompensation(user.id, tier, cfg);
  }
  const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { points: true, pointsTotalEarned: true } });
  const txns = await prisma.pointTxn.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 });
  const points = fresh?.points ?? 0;

  return (
    <main className="pf-wrap">
      <div className="pf-col">
        <p className="crumb"><Link href="/account">← Hồ sơ</Link></p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800, margin: "4px 0 16px" }}>Điểm của tôi</h1>

        <section className="pf-card">
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <span className="pt-coin">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinejoin="round"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.8l-5.3 2.9 1.1-5.9L3.5 9.7l5.9-.8L12 3.5z" /></svg>
            </span>
            <span className="pt-big">{points.toLocaleString("vi-VN")}</span>
            <span className="pt-eq">= {fmtUSD(points)}</span>
          </div>
          <p style={{ marginTop: 16, color: "var(--ink-2)", fontSize: 15 }}>
            100 điểm = $1.00 <span style={{ margin: "0 10px", color: "#D8D2C4" }}>|</span> Đã tích tổng cộng {(fresh?.pointsTotalEarned ?? 0).toLocaleString("vi-VN")} điểm
          </p>
          <p style={{ marginTop: 12, display: "flex", gap: 10, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.55 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B63E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 2 }}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
            Dùng điểm ở bước thanh toán: điểm trả được tối đa {cfg.maxPayPercent}% mỗi đơn hàng, cộng dồn được với mã giảm giá. Đánh giá đơn đã giao để nhận +{cfg.perReview} điểm (tối đa {cfg.dailyCap} lần/ngày).
          </p>
        </section>

        <section className="pf-card">
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 21, margin: "0 0 6px" }}>Lịch sử điểm</h2>
          {txns.map((t) => (
            <div key={t.id} className="wl-row">
              <div className="r-main">
                <div className="r-title">{KIND_LABEL[t.kind] ?? t.kind}</div>
                <div className="r-sub">{t.createdAt.toLocaleString("vi-VN")}{t.note ? ` · ${t.note}` : ""}</div>
              </div>
              <div>
                <div className="r-amt" style={{ color: t.delta >= 0 ? "#177245" : "#B3261E" }}>{t.delta >= 0 ? "+" : ""}{t.delta.toLocaleString("vi-VN")} điểm</div>
                <div className="r-sub" style={{ textAlign: "right" }}>Số dư {t.balanceAfter.toLocaleString("vi-VN")}</div>
              </div>
            </div>
          ))}
          {!txns.length && (
            <div style={{ textAlign: "center", padding: "38px 0 26px" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0B63E5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto" }}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, marginTop: 14 }}>Chưa có hoạt động điểm nào.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
