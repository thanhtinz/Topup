import Link from "next/link";
import { getActivePartnershipTypes, typeSlug } from "@/lib/partnership";

export const dynamic = "force-dynamic";

const STEPS: Array<[string, string]> = [
  ["Gửi hồ sơ", "Chọn loại hình và gửi đề xuất hợp tác — không cần tài khoản."],
  ["Đánh giá", "Đội Partnership xem xét hồ sơ, có thể yêu cầu bổ sung thông tin."],
  ["Trao đổi", "Hai bên thống nhất phạm vi công việc, deliverables, KPI và chi phí."],
  ["Thống nhất thỏa thuận", "Lưu thỏa thuận/hợp đồng và lên lịch triển khai."],
  ["Triển khai", "Đối tác thực hiện và nộp deliverables theo deadline."],
  ["Nghiệm thu & thanh toán", "BNTGame nghiệm thu và thanh toán theo thỏa thuận."],
];

const WHY: Array<[string, string]> = [
  ["Đa dạng hình thức hợp tác", "Từ phí cố định cho nội dung, tài trợ sự kiện đến đại sứ thương hiệu — không ép mọi hợp tác phải gắn với link giới thiệu hay hoa hồng."],
  ["Thỏa thuận rõ ràng, lưu vết đầy đủ", "Mọi chiến dịch đều có brief, deliverables, deadline và thỏa thuận được lưu lại; nghiệm thu theo từng đầu việc."],
  ["Thanh toán theo cam kết", "Khoản chi được tạo theo thỏa thuận, có trạng thái duyệt và chứng từ rõ ràng; phí tài trợ và hoa hồng Affiliate luôn tách bạch."],
  ["Đội Partnership hỗ trợ riêng", "Một đầu mối phụ trách theo dõi hồ sơ của bạn từ lúc gửi đến khi nghiệm thu, phản hồi qua email trong 1–3 ngày làm việc."],
];

const FAQS: Array<[string, string]> = [
  ["Tôi có cần đăng ký Affiliate mới hợp tác được không?", "Không. Affiliate chỉ là một trong nhiều loại hình hợp tác. Bạn hoàn toàn có thể nhận phí cố định cho video, tài trợ cho sự kiện hoặc phí đặt banner cộng đồng mà không cần link giới thiệu hay mã giảm giá."],
  ["Gửi hồ sơ có cần tài khoản BNTGame không?", "Không bắt buộc. Bạn gửi hồ sơ trực tiếp trên trang này; khi hợp tác được triển khai, chúng tôi sẽ hướng dẫn tạo tài khoản để theo dõi chiến dịch và thanh toán nếu cần."],
  ["Mức phí hợp tác được tính thế nào?", "BNTGame không công bố bảng phí cố định. Mức phí được thương lượng theo từng đề xuất dựa trên quy mô kênh/cộng đồng, phạm vi công việc và quyền lợi hai bên. Bạn có thể ghi mức mong muốn trong hồ sơ hoặc để thương lượng."],
  ["Bao lâu thì nhận được phản hồi?", "Đội Partnership thường phản hồi trong 1–3 ngày làm việc. Nếu hồ sơ cần bổ sung thông tin, chúng tôi sẽ ghi rõ cần bổ sung gì trong email phản hồi."],
  ["Hồ sơ được duyệt có nghĩa là đã ký hợp đồng chưa?", "Chưa. Duyệt hồ sơ nghĩa là BNTGame đồng ý tiếp tục trao đổi. Nghĩa vụ triển khai và thanh toán chỉ phát sinh khi hai bên xác nhận thỏa thuận/hợp đồng cụ thể cho từng chiến dịch."],
  ["BNTGame thanh toán bằng cách nào?", "Theo thỏa thuận từng chiến dịch: chuyển khoản ngân hàng hoặc USDT. Khoản tài trợ bằng sản phẩm/số dư được ghi nhận riêng theo giá trị đã thống nhất."],
];

export default async function PartnershipPage() {
  const types = await getActivePartnershipTypes();
  return (
    <div className="container" style={{ maxWidth: 1060, paddingTop: 26, paddingBottom: 48 }}>
      <div className="ptn-hero">
        <h1>BNTGame Partnership Program</h1>
        <p>Hợp tác cùng BNTGame theo cách phù hợp với bạn: sáng tạo nội dung, livestream, cộng đồng, tài trợ sự kiện, truyền thông, đại sứ thương hiệu hay kinh doanh. Affiliate chỉ là một lựa chọn — không phải điều kiện bắt buộc.</p>
        <div className="cta-row">
          <Link className="btn btn-lg" style={{ background: "#fff", color: "#0B63E5", fontWeight: 800 }} href="/partnership/apply">Gửi hồ sơ hợp tác</Link>
          <a className="btn btn-lg" style={{ background: "rgba(255,255,255,.16)", color: "#fff", border: "1px solid rgba(255,255,255,.5)" }} href="#loai-hinh">Xem các loại hình</a>
        </div>
      </div>

      <section className="ptn-sec" id="loai-hinh">
        <h2>Các loại hình hợp tác đang tiếp nhận</h2>
        <div className="ptn-grid">
          {types.map((t) => (
            <Link key={t.code} className="ptn-card" href={`/partnership/${typeSlug(t.code)}`}>
              <h3>{t.name}</h3>
              <p>{t.tagline}</p>
              <span className="go">Tìm hiểu & gửi hồ sơ →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="ptn-sec">
        <h2>Vì sao hợp tác với BNTGame?</h2>
        <div className="ptn-cols">
          {WHY.map(([b, s]) => (
            <div key={b} className="ptn-why"><b>{b}</b><span>{s}</span></div>
          ))}
        </div>
      </section>

      <section className="ptn-sec">
        <h2>Quy trình hợp tác</h2>
        <div className="ptn-steps">
          {STEPS.map(([b, s], i) => (
            <div key={b} className="ptn-step"><span className="ptn-num">{i + 1}</span><div><b>{b}</b><span>{s}</span></div></div>
          ))}
        </div>
      </section>

      <section className="ptn-sec">
        <h2>Yêu cầu cơ bản với đối tác</h2>
        <div className="ptn-why">
          <span>
            Kênh/cộng đồng thuộc sở hữu của bạn hoặc bạn có quyền đại diện; nội dung tuân thủ pháp luật và chính sách của nền tảng;
            không dùng traffic gian lận, nội dung vi phạm bản quyền hoặc gây hiểu nhầm cho người dùng;
            thông tin trong hồ sơ (quy mô kênh, số liệu khán giả) phải trung thực — BNTGame có thể yêu cầu bằng chứng khi đánh giá.
          </span>
        </div>
      </section>

      <section className="ptn-sec ptn-faq">
        <h2>Câu hỏi thường gặp</h2>
        {FAQS.map(([q, a]) => (
          <details key={q}><summary>{q}</summary><p>{a}</p></details>
        ))}
      </section>

      <div className="ptn-hero" style={{ textAlign: "center", marginBottom: 0 }}>
        <h1 style={{ fontSize: 24 }}>Sẵn sàng hợp tác cùng BNTGame?</h1>
        <p style={{ margin: "0 auto" }}>Gửi hồ sơ mất khoảng 3 phút. Đội Partnership sẽ phản hồi qua email.</p>
        <div className="cta-row" style={{ justifyContent: "center" }}>
          <Link className="btn btn-lg" style={{ background: "#fff", color: "#0B63E5", fontWeight: 800 }} href="/partnership/apply">Gửi hồ sơ hợp tác</Link>
        </div>
      </div>
    </div>
  );
}
