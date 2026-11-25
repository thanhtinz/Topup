import Link from "next/link";
import { creatorConfig, getPartnerCreators } from "@/lib/creator";
import PartnerGrid from "../PartnerGrid";

export const dynamic = "force-dynamic";

export default async function CreatorPartners() {
  const cfg = await creatorConfig();
  const creators = cfg.enabled ? await getPartnerCreators().catch(() => []) : [];
  return (
    <div className="container" style={{ paddingBottom: 44, maxWidth: 860 }}>
      <div className="crt-hero" style={{ marginTop: 16 }}>
        <h1>Affiliate đồng hành cùng BNTGame</h1>
        <p>Tất cả Affiliate đang hợp tác cùng BNTGame, xếp theo doanh số gần nhất. Bấm vào từng Affiliate để xem các kênh của họ.</p>
      </div>
      {creators.length ? (
        <div style={{ marginTop: 18 }}>
          <PartnerGrid creators={creators} />
        </div>
      ) : (
        <div className="crt-card" style={{ marginTop: 18 }}>
          <p>Danh sách Affiliate đồng hành đang được cập nhật.</p>
        </div>
      )}
      <div className="crt-card" style={{ marginTop: 18, textAlign: "center" }}>
        <h3>Bạn cũng muốn làm Affiliate?</h3>
        <p>Tham gia chương trình để nhận hoa hồng trên mỗi đơn từ link của bạn.</p>
        <p style={{ marginTop: 12 }}><Link className="btn btn-primary" href="/partnership/apply?type=affiliate">Đăng ký Affiliate</Link></p>
      </div>
      <p style={{ marginTop: 14 }}><Link href="/creators" style={{ color: "var(--accent)", fontWeight: 600 }}>← Về trang chương trình Affiliate</Link></p>
    </div>
  );
}
