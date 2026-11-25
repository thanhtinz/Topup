import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { codeFromSlug, typeSlug } from "@/lib/partnership";

export const dynamic = "force-dynamic";

const FIT: Record<string, string[]> = {
  CREATOR: ["YouTuber, TikToker, reviewer có kênh nội dung về game", "Sản xuất video/bài viết theo brief, phí cố định hoặc kết hợp Affiliate nếu muốn", "Số liệu kênh minh bạch, nội dung đúng cam kết"],
  STREAMER: ["Streamer livestream game thường xuyên trên Twitch, YouTube, Facebook...", "Đặt logo, nhắc thương hiệu hoặc buổi stream chuyên đề theo lịch thống nhất", "Tính phí theo buổi hoặc theo tháng"],
  COMMUNITY: ["Chủ Discord server, Facebook Group, diễn đàn cộng đồng game", "Đặt banner, bài đăng giới thiệu hoặc hoạt động tài trợ cho thành viên", "Cộng đồng hoạt động thật, tương tác thật"],
  SPONSORSHIP: ["Đơn vị tổ chức giải đấu, sự kiện, giveaway hoặc đội tuyển", "Tài trợ tiền mặt, sản phẩm, số dư hoặc giải thưởng theo từng hạng mục", "Quyền lợi nhà tài trợ được ghi nhận và có bằng chứng thực hiện"],
  MEDIA: ["Trang tin, blog, kênh nội dung hướng dẫn/đánh giá game", "Bài PR, bài đánh giá hoặc đồng sản xuất nội dung cùng BNTGame", "Tính phí theo bài hoặc theo gói nội dung"],
  AMBASSADOR: ["Gương mặt có ảnh hưởng bền vững trong cộng đồng game", "Lịch đăng nội dung định kỳ và cam kết hình ảnh theo thời hạn", "Phí định kỳ, có thể kèm bonus KPI theo thỏa thuận"],
  BUSINESS: ["Nhà phát hành, nhà cung cấp game, agency, đơn vị thanh toán", "Hợp tác theo hợp đồng: chiết khấu, phí dịch vụ hoặc chia sẻ doanh thu", "Trao đổi qua người đại diện chính thức của tổ chức"],
  AFFILIATE: ["Nhà sáng tạo, cộng đồng hoặc cá nhân muốn giới thiệu khách hàng cho BNTGame", "Nhận link và mã giới thiệu riêng, hoa hồng theo đơn hàng đủ điều kiện", "Module tùy chọn — chỉ bật khi thỏa thuận của bạn là Affiliate"],
  CUSTOM: ["Ý tưởng hợp tác chưa thuộc nhóm nào", "Mô tả rõ đề xuất trong hồ sơ, đội Partnership sẽ phản hồi phương án", "Mọi điều khoản thương lượng riêng theo từng trường hợp"],
};

export default async function PartnershipTypePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const code = codeFromSlug(slug);
  if (!code) notFound();
  const type = await prisma.partnershipType.findUnique({ where: { code } });
  if (!type || !type.isActive) notFound();
  const fit = FIT[code] ?? [];

  return (
    <div className="container" style={{ maxWidth: 860, paddingTop: 26, paddingBottom: 48 }}>
      <p style={{ marginBottom: 12 }}><Link href="/partnership" style={{ color: "var(--accent)", fontWeight: 600 }}>← Tất cả loại hình hợp tác</Link></p>
      <div className="ptn-hero">
        <h1>{type.name}</h1>
        <p>{type.tagline}</p>
        <div className="cta-row">
          <Link className="btn btn-lg" style={{ background: "#fff", color: "#0B63E5", fontWeight: 800 }} href={`/partnership/apply?type=${typeSlug(code)}`}>Gửi hồ sơ {type.name}</Link>
        </div>
      </div>

      <section className="ptn-sec">
        <h2>Giới thiệu</h2>
        <div className="ptn-why"><span style={{ fontSize: 14.5 }}>{type.description}</span></div>
      </section>

      {fit.length > 0 && (
        <section className="ptn-sec">
          <h2>Hình thức này phù hợp khi</h2>
          <div className="ptn-cols">
            {fit.map((f) => (
              <div key={f} className="ptn-why"><span style={{ fontSize: 14 }}>{f}</span></div>
            ))}
          </div>
        </section>
      )}

      {code === "AFFILIATE" && (
        <section className="ptn-sec">
          <h2>Chương trình Affiliate hiện tại</h2>
          <div className="ptn-why">
            <span style={{ fontSize: 14.5, marginBottom: 10 }}>
              Chương trình Affiliate của BNTGame đang vận hành dưới tên Creator Program: link giới thiệu riêng, mã giảm giá cho khách,
              hoa hồng theo cấp và rút tiền USDT/chuyển khoản. Nếu bạn chỉ muốn tham gia Affiliate, bạn có thể đăng ký trực tiếp tại trang chương trình.
            </span>
            <Link className="btn btn-primary" href="/creators">Xem chương trình Affiliate</Link>
          </div>
        </section>
      )}

      <section className="ptn-sec">
        <h2>Làm việc thế nào?</h2>
        <div className="ptn-steps">
          <div className="ptn-step"><span className="ptn-num">1</span><div><b>Gửi hồ sơ</b><span>Mô tả kênh/cộng đồng và đề xuất của bạn.</span></div></div>
          <div className="ptn-step"><span className="ptn-num">2</span><div><b>Trao đổi & thỏa thuận</b><span>Thống nhất phạm vi, deliverables, deadline và chi phí. BNTGame không cam kết mức phí trước khi đánh giá hồ sơ.</span></div></div>
          <div className="ptn-step"><span className="ptn-num">3</span><div><b>Triển khai & nghiệm thu</b><span>Thực hiện theo brief, nộp deliverables, nghiệm thu và thanh toán theo thỏa thuận.</span></div></div>
        </div>
      </section>

      <div style={{ textAlign: "center" }}>
        <Link className="btn btn-primary btn-lg" href={`/partnership/apply?type=${typeSlug(code)}`}>Gửi hồ sơ hợp tác ngay</Link>
      </div>
    </div>
  );
}
