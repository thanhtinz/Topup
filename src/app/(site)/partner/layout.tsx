import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPartnerForUser } from "@/lib/partner-portal";
import { PARTNER_STATUS } from "@/lib/partnership";
import { PartnerNav } from "./PartnerNav";

export const dynamic = "force-dynamic";

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const partner = await getPartnerForUser(user.id);

  return (
    <main className="bsx">
      <div className="container" style={{ maxWidth: 980, paddingTop: 28, paddingBottom: 52 }}>
        <p className="crumb"><Link href="/account">← Hồ sơ</Link></p>
        <div style={{ borderRadius: 20, background: "#EFF6FE", border: "1px solid #BCD9FB", padding: "24px 26px" }}>
          <h1 className="bsx-h1" style={{ margin: 0 }}>Partner Portal</h1>
          {partner ? (
            <p style={{ margin: "8px 0 0", color: "#425466" }}>
              {partner.displayName} · {PARTNER_STATUS[partner.status] ?? partner.status}
            </p>
          ) : (
            <p style={{ margin: "8px 0 0", color: "#425466" }}>Khu vực dành cho đối tác của BNTGame</p>
          )}
        </div>

        {!partner ? (
          <div style={{ marginTop: 22, border: "1px solid #E3E8EF", borderRadius: 16, padding: "22px 24px" }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Tài khoản chưa gắn hồ sơ đối tác</h2>
            <p style={{ color: "#425466", lineHeight: 1.6 }}>
              Partner Portal chỉ mở cho đối tác đã được duyệt. Nếu bạn đã nộp hồ sơ hợp tác, hồ sơ cần được
              BNTGame chấp thuận và gắn với tài khoản này trước khi truy cập được. Nếu chưa nộp, bạn có thể
              gửi hồ sơ tại trang Hợp tác.
            </p>
            <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/partnership/apply" style={{ background: "#0B63E5", color: "#fff", padding: "10px 16px", borderRadius: 10, fontWeight: 600, textDecoration: "none" }}>Nộp hồ sơ hợp tác</Link>
              <Link href="/partnership" style={{ background: "#EEF2F7", color: "#1F2A37", padding: "10px 16px", borderRadius: 10, fontWeight: 600, textDecoration: "none" }}>Tìm hiểu chương trình</Link>
            </p>
          </div>
        ) : partner.status === "SUSPENDED" ? (
          <div style={{ marginTop: 22, border: "1px solid #F3C2C2", background: "#FDF1F1", borderRadius: 16, padding: "22px 24px" }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Hồ sơ đối tác đang bị tạm khóa</h2>
            <p style={{ color: "#7A2E2E", lineHeight: 1.6, margin: 0 }}>
              Quyền truy cập Partner Portal của bạn đang tạm dừng. Vui lòng liên hệ đội Partnership của BNTGame để được hỗ trợ.
            </p>
          </div>
        ) : (
          <>
            <PartnerNav />
            {children}
          </>
        )}
      </div>
    </main>
  );
}
