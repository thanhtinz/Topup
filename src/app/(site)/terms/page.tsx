import { getSettings } from "@/lib/settings";
import TextBlocks from "@/components/TextBlocks";

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const s = await getSettings();
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 820 }}>
        <h1 className="page-title">Điều khoản dịch vụ</h1>
        <div className="prose-page">
          {s.terms_content?.trim() ? (
            <TextBlocks content={s.terms_content} siteName={s.site_name} supportEmail={s.support_email} />
          ) : (
          <>
          <p>Khi tạo tài khoản và sử dụng dịch vụ tại {s.site_name}, bạn đồng ý với các điều khoản dưới đây.</p>
          <h2>Dịch vụ</h2>
          <p>Chúng tôi cung cấp dịch vụ nạp game theo các gói hiển thị trên website. Giá, khu vực và hình thức nạp của từng gói được ghi rõ ở trang game trước khi bạn đặt đơn.</p>
          <h2>Tài khoản và ví</h2>
          <p>Bạn chịu trách nhiệm bảo mật tài khoản của mình. Số dư ví chỉ dùng để thanh toán đơn trong hệ thống, không quy đổi ngược thành tiền mặt. Lệnh nạp qua cổng thanh toán được cộng ví tự động khi giao dịch khớp.</p>
          <h2>Đơn hàng và hoàn tiền</h2>
          <p>Hãy kiểm tra kỹ thông tin nạp (UID, máy chủ, khu vực) trước khi đặt — đơn đã giao thành công theo đúng thông tin bạn cung cấp sẽ không được hoàn. Đơn lỗi do hệ thống hoặc nhà cung cấp sẽ được hoàn toàn bộ vào ví, kèm điểm đã dùng (nếu có).</p>
          <h2>Điểm và VIP</h2>
          <p>Điểm thưởng không có giá trị tiền mặt ngoài hệ thống, được dùng để giảm giá đơn theo tỉ lệ công bố. Hạng VIP tính theo chi tiêu 30 ngày và có thể thay đổi theo chính sách từng thời kỳ; chúng tôi sẽ thông báo khi có thay đổi lớn.</p>
          <h2>Liên hệ</h2>
          <p>Mọi thắc mắc về điều khoản, liên hệ {s.support_email} hoặc trang Hỗ trợ.</p>
          </>
          )}
        </div>
      </div>
    </main>
  );
}
