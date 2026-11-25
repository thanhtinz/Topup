import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { creatorConfig, ensureCreatorLevels, getCreatorByUser } from "@/lib/creator";
import { fmtMoney } from "@/lib/moneyfmt";
import { getPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

const BENEFITS = [
  ["Hoa hồng theo cấp độ", "Từ 2% tới 7% trên doanh thu đủ điều kiện, tự nâng cấp theo doanh thu 30 ngày. Đối tác xác minh và đối tác chính thức có tỉ lệ ưu đãi riêng."],
  ["Link affiliate riêng", "Mỗi Affiliate có link /ref riêng và tạo thêm link theo từng game, từng chiến dịch — theo dõi click, đơn hàng và doanh thu theo từng link."],
  ["Mã giảm giá riêng", "Được cấp mã giảm giá mang dấu ấn cá nhân. Khách dùng mã của bạn là doanh thu được ghi nhận cho bạn."],
  ["Dashboard theo thời gian thực", "Click, chuyển đổi, đơn hàng, hoa hồng và sản phẩm hiệu quả nhất — tất cả trong Affiliate Dashboard."],
  ["Chiến dịch & tài trợ", "Tham gia campaign theo game/sự kiện với bonus hoa hồng, cơ hội tài trợ livestream và video cho Affiliate đạt chuẩn."],
  ["Rút tiền linh hoạt", "Rút qua USDT hoặc chuyển khoản ngân hàng VN khi đạt mức tối thiểu. Hoa hồng được giữ 7 ngày để chống gian lận rồi chuyển sang có thể rút."],
];

const FAQS = [
  ["Ai có thể trở thành Affiliate?", "Streamer, YouTuber, TikToker và influencer gaming ở mọi quy mô. Gửi đơn đăng ký, BNTGame xét duyệt dựa trên kênh và nội dung của bạn."],
  ["Hoa hồng được tính thế nào?", "Hoa hồng = doanh thu đủ điều kiện (số tiền khách thật trả sau giảm giá) × tỉ lệ cấp độ của bạn. Đơn hoàn tiền hoặc gian lận sẽ bị thu hồi hoa hồng."],
  ["Khi nào tôi rút được tiền?", "Hoa hồng chờ xác nhận trong thời gian giữ (mặc định 7 ngày), sau đó chuyển sang có thể rút. Mức rút tối thiểu mặc định $20, xử lý 3–7 ngày làm việc."],
  ["Khách đến từ link của tôi nhưng dùng mã của người khác thì sao?", "Mã giảm giá gắn riêng cho Affiliate được ưu tiên ghi nhận; nếu không có mã, hệ thống dùng lượt click hợp lệ gần nhất trong 30 ngày."],
];

export default async function CreatorsLanding() {
  const { cur, lang } = await getPrefs();
  const fmt = (c: number) => fmtMoney(c, cur, lang);
  const cfg = await creatorConfig();
  await ensureCreatorLevels();
  const levels = await prisma.creatorLevel.findMany({ orderBy: { sort: "asc" } });
  const campaigns = await prisma.creatorCampaign.findMany({ where: { status: "ACTIVE" }, orderBy: { startAt: "desc" }, take: 3 });
  const user = await getCurrentUser();
  const creator = user ? await getCreatorByUser(user.id) : null;
  const topCreators = cfg.rankingPublic
    ? await prisma.creator.findMany({ where: { status: "ACTIVE" }, take: 5, include: { level: true, commissions: { where: { status: { not: "REVERSED" } }, select: { eligibleCents: true } } } })
    : [];
  const ranking = topCreators
    .map((c) => ({ name: c.displayName, level: c.level?.name ?? "", revenue: c.commissions.reduce((a, x) => a + x.eligibleCents, 0) }))
    .sort((a, b) => b.revenue - a.revenue)
    .filter((r) => r.revenue > 0)
    .slice(0, 5);

  return (
    <div className="container" style={{ paddingBottom: 44 }}>
      <div className="crt-hero">
        <h1>BNTGame Affiliate Partnership</h1>
        <p>Chương trình hợp tác dành cho Streamer, YouTuber, TikToker và Gaming Influencer. Quảng bá BNTGame bằng link và mã giảm giá riêng, nhận hoa hồng trên từng đơn hàng bạn mang về.</p>
        {creator ? (
          <Link className="btn" href="/creator/dashboard">Vào Affiliate Dashboard</Link>
        ) : (
          <Link className="btn" href="/partnership/apply?type=affiliate">Đăng ký trở thành Affiliate</Link>
        )}
      </div>
      {!cfg.enabled && <div className="crt-card" style={{ marginBottom: 14 }}><p>Chương trình đang tạm đóng đăng ký mới. Affiliate hiện tại vẫn truy cập dashboard bình thường.</p></div>}

      <h2 style={{ margin: "8px 0 4px" }}>Quyền lợi đối tác</h2>
      <div className="crt-grid">
        {BENEFITS.map(([t, d]) => (
          <div key={t} className="crt-card"><h3>{t}</h3><p>{d}</p></div>
        ))}
      </div>

      <h2 style={{ margin: "18px 0 10px" }}>Cấp độ & hoa hồng</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="crt-table">
          <thead><tr><th>Cấp độ</th><th>Điều kiện doanh thu 30 ngày</th><th>Hoa hồng</th></tr></thead>
          <tbody>
            {levels.map((l) => (
              <tr key={l.id}>
                <td><span className="crt-badge" style={{ background: `${l.color}22`, color: l.color }}>{l.name}</span></td>
                <td>{l.minRevenue30dCents > 0 ? `Từ ${fmt(l.minRevenue30dCents)}` : "Mặc định khi được duyệt"}</td>
                <td><strong>{(l.rateBps / 100).toFixed(2).replace(/\.?0+$/, "")}%</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13.5 }}>Affiliate đã xác thực và Official Partner được thỏa thuận tỉ lệ riêng, tham gia chiến dịch độc quyền và nhận tài trợ nội dung.</p>

      <h2 style={{ margin: "18px 0 10px" }}>Cách hoạt động</h2>
      <div className="crt-grid">
        {[["1. Đăng ký & duyệt hồ sơ", "Điền đơn với thông tin kênh của bạn. BNTGame xét duyệt và kích hoạt tài khoản Affiliate."], ["2. Chia sẻ link & mã", "Dán link affiliate và mã giảm giá của bạn vào livestream, video và mạng xã hội."], ["3. Nhận hoa hồng & rút tiền", "Đơn hàng từ khách của bạn sinh hoa hồng tự động. Đủ thời gian giữ thì rút qua USDT hoặc chuyển khoản ngân hàng VN."]].map(([t, d]) => (
          <div key={t} className="crt-card"><h3>{t}</h3><p>{d}</p></div>
        ))}
      </div>

      {campaigns.length > 0 && (
        <>
          <h2 style={{ margin: "18px 0 10px" }}>Chiến dịch đang chạy</h2>
          <div className="crt-grid">
            {campaigns.map((c) => (
              <div key={c.id} className="crt-card">
                <h3>{c.name}</h3>
                <p>{c.description || "Chiến dịch quảng bá của BNTGame."}</p>
                <p style={{ marginTop: 8 }}><span className="crt-badge gold">Bonus +{(c.bonusBps / 100).toFixed(2).replace(/\.?0+$/, "")}%</span></p>
              </div>
            ))}
          </div>
        </>
      )}

      {ranking.length > 0 && (
        <>
          <h2 style={{ margin: "18px 0 10px" }}>Bảng xếp hạng Affiliate</h2>
          <div style={{ overflowX: "auto" }}>
            <table className="crt-table">
              <thead><tr><th>#</th><th>Affiliate</th><th>Cấp</th><th>Doanh thu mang về</th></tr></thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.name}><td>{i + 1}</td><td><strong>{r.name}</strong></td><td>{r.level}</td><td>{fmt(r.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 style={{ margin: "18px 0 10px" }}>Câu hỏi thường gặp</h2>
      <div className="crt-grid">
        {FAQS.map(([q, a]) => (
          <div key={q} className="crt-card"><h3>{q}</h3><p>{a}</p></div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 26 }}>
        <Link className="btn btn-primary" href={creator ? "/creator/dashboard" : "/partnership/apply?type=affiliate"}>{creator ? "Vào Affiliate Dashboard" : "Đăng ký trở thành Affiliate"}</Link>
      </div>
    </div>
  );
}
