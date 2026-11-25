import { getSettings } from "@/lib/settings";
import TextBlocks from "@/components/TextBlocks";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const s = await getSettings();
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 820 }}>
        <h1 className="page-title">Chính sách bảo mật</h1>
        <div className="prose-page">
          {s.privacy_content?.trim() ? (
            <TextBlocks content={s.privacy_content} siteName={s.site_name} supportEmail={s.support_email} />
          ) : (
          <>
          <p>{s.site_name} tôn trọng và bảo vệ thông tin cá nhân của khách hàng. Chính sách này mô tả những thông tin chúng tôi thu thập, mục đích sử dụng và quyền của bạn.</p>
          <h2>Thông tin chúng tôi thu thập</h2>
          <p>Thông tin tài khoản (họ tên, email), thông tin đơn hàng và nạp tiền (game, gói nạp, thông tin nạp bạn cung cấp như UID), và dữ liệu kỹ thuật cần thiết để vận hành dịch vụ (cookie phiên đăng nhập, lựa chọn ngôn ngữ và tiền tệ).</p>
          <h2>Mục đích sử dụng</h2>
          <p>Thông tin chỉ dùng để xử lý đơn nạp, cộng ví, hỗ trợ khách hàng, phòng chống gian lận và cải thiện dịch vụ. Chúng tôi không bán thông tin cá nhân của bạn cho bên thứ ba.</p>
          <h2>Chia sẻ thông tin</h2>
          <p>Thông tin nạp (ví dụ UID game) được gửi cho nhà cung cấp dịch vụ nạp để thực thi đơn hàng của bạn. Ngoài trường hợp này và yêu cầu hợp pháp của cơ quan nhà nước, chúng tôi không chia sẻ dữ liệu của bạn.</p>
          <h2>Bảo mật và lưu trữ</h2>
          <p>Mật khẩu được lưu dưới dạng băm một chiều, khoá API được mã hoá, phiên đăng nhập dùng cookie httpOnly. Bạn có thể liên hệ {s.support_email} để yêu cầu xem, sửa hoặc xoá dữ liệu cá nhân của mình.</p>
          </>
          )}
        </div>
      </div>
    </main>
  );
}
