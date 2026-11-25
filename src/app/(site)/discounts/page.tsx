import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { pointsConfig, userTier, ensureMonthlyCoupon } from "@/lib/points";
import CopyBtn from "@/components/CopyBtn";

export const dynamic = "force-dynamic";

function remaining(expiresAt: Date, now: Date) {
  const ms = expiresAt.getTime() - now.getTime();
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `Còn ${days} ngày`;
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `Còn ${hours} giờ`;
  return `Còn ${Math.max(1, Math.floor(ms / 60000))} phút`;
}

const ticketSvg = (size: number) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2M13 17v2M13 11v2" /></svg>
);

export default async function DiscountsPage() {
  const user = await getCurrentUser();
  const s = await getSettings();
  const now = new Date();
  const all = s.module_discount === "1"
    ? await prisma.discountCode.findMany({ where: { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { percent: "desc" }] })
    : [];
  const publicCodes = all.filter((c) => !c.code.startsWith("VIP") && (!c.maxUses || c.usedCount < c.maxUses));
  let myCoupon: string | null = null;
  let myCouponPct = 0;
  if (user) {
    const cfg = await pointsConfig();
    if (cfg.enabled) {
      const { tier } = await userTier(user.id);
      myCoupon = await ensureMonthlyCoupon(user.id, tier, cfg);
      myCouponPct = tier?.couponPercent ?? 0;
    }
  }
  const empty = !publicCodes.length && !myCoupon;

  const codeCard = (code: string, percent: number, mine: boolean, expiresAt: Date | null, remainingUses: number | null) => (
    <div key={code} className="bsx-card" style={{ padding: 20, display: "flex", flexDirection: "column", ...(mine ? { borderColor: "#1FB6F2", boxShadow: "0 0 0 1px #1FB6F2, 0 8px 24px rgba(27,46,94,.08)" } : {}) }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: "#E11D48" }}>-{percent}%</div>
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", color: "#94A3B8" }}>Giảm giá{mine ? " · Mã VIP tháng của bạn" : ""}</div>
        </div>
        <span style={{ width: 40, height: 40, flex: "none", borderRadius: 12, background: "#EAF3FE", color: "#0B63E5", display: "flex", alignItems: "center", justifyContent: "center" }}>{ticketSvg(20)}</span>
      </div>
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: "1px dashed #8FC3F8", background: "#EAF3FE", borderRadius: 8, padding: "6px 6px 6px 12px" }}>
        <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 14, fontWeight: 700, letterSpacing: ".03em", color: "#0A45B4" }}>{code}</span>
        <CopyBtn text={code} label="Chép mã" />
      </div>
      <dl style={{ margin: "16px 0 0", borderTop: "1px dashed #E2E8F0", paddingTop: 14, display: "grid", gap: 8, fontSize: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <dt style={{ color: "#64748B" }}>Áp dụng cho</dt>
          <dd style={{ margin: 0, fontWeight: 600, color: "#1E293B" }}>Tất cả đơn nạp</dd>
        </div>
        {expiresAt && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <dt style={{ color: "#64748B" }}>Thời hạn</dt>
            <dd style={{ margin: 0, fontWeight: 600, color: "#1E293B" }}>{expiresAt.toLocaleDateString("vi-VN")}</dd>
          </div>
        )}
        {remainingUses !== null && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <dt style={{ color: "#64748B" }}>Lượt dùng còn lại</dt>
            <dd style={{ margin: 0, fontWeight: 600, color: "#1E293B" }}>{remainingUses}</dd>
          </div>
        )}
      </dl>
      {expiresAt && (
        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#FFF1F2", color: "#E11D48", fontSize: 12, fontWeight: 700, borderRadius: 999, padding: "5px 11px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
            {remaining(expiresAt, now)}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <main className="bsx">
      <div className="container" style={{ paddingTop: 36, paddingBottom: 52 }}>
        <div className="bsx-banner">
          <span className="bsx-banner-ico">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 5L5 19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>
          </span>
          <div>
            <h1>Ưu đãi</h1>
            <p>Các mã giảm giá đang áp dụng cho mọi khách hàng.</p>
          </div>
        </div>

        {empty ? (
          <div className="bsx-card" style={{ marginTop: 30, padding: "40px 20px", textAlign: "center" }}>
            <span style={{ margin: "0 auto", width: 56, height: 56, borderRadius: 16, background: "#F1F5F9", color: "#94A3B8", display: "flex", alignItems: "center", justifyContent: "center" }}>{ticketSvg(28)}</span>
            <p style={{ marginTop: 16, fontSize: 15, fontWeight: 500, color: "#475569" }}>
              Hiện chưa có mã ưu đãi nào đang công khai.{user ? " Lên hạng VIP để nhận mã riêng mỗi tháng ở Câu lạc bộ." : <> <Link href="/?auth=login" style={{ color: "#0B63E5", fontWeight: 700 }}>Đăng nhập</Link> để xem mã dành riêng cho bạn.</>}
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
            {myCoupon && codeCard(myCoupon, myCouponPct, true, new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59), 1)}
            {publicCodes.map((c) => codeCard(c.code, c.percent, false, c.expiresAt, c.maxUses ? Math.max(0, c.maxUses - c.usedCount) : null))}
          </div>
        )}
      </div>
    </main>
  );
}
