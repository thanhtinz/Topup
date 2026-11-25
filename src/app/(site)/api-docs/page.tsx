import Link from "next/link";

export const metadata = {
  title: "Tài liệu API đấu nối — BNTGame",
  description: "Tài liệu API BNTGame cho khách đấu nối: danh mục game & gói, số dư ví, tạo đơn nạp và tra trạng thái đơn bằng API key.",
};

const BASE = "https://bntgame.com/api/v1";

function Code({ children }: { children: string }) {
  return <pre className="docs-code">{children}</pre>;
}

function Endpoint({ method, path, title, children }: { method: string; path: string; title: string; children: React.ReactNode }) {
  return (
    <section className="docs-sec">
      <h3><span className={`docs-method ${method === "GET" ? "get" : "post"}`}>{method}</span> <code>{path}</code></h3>
      <p className="docs-sec-title">{title}</p>
      {children}
    </section>
  );
}

export default function ApiDocsPage() {
  return (
    <main className="bsx">
      <div className="container" style={{ maxWidth: 880, paddingTop: 28, paddingBottom: 56 }}>
        <h1 style={{ fontSize: 27, marginBottom: 8 }}>Tài liệu API đấu nối</h1>
        <p className="muted" style={{ maxWidth: 760, marginBottom: 20 }}>
          API dành cho khách hàng muốn tích hợp BNTGame vào hệ thống của mình (web đại lý, bot, app): lấy danh mục game & gói theo thời gian thực,
          kiểm tra số dư ví, tạo đơn nạp tự động và tra trạng thái đơn. Tiền của mọi đơn API được trừ trực tiếp từ ví BNTGame của bạn.
        </p>

        <section className="docs-sec">
          <h3>Bắt đầu nhanh</h3>
          <ol className="docs-list">
            <li>Đăng nhập BNTGame, vào <Link href="/account/api-keys"><strong>Tài khoản → API đấu nối</strong></Link> và tạo API key. Khoá chỉ hiển thị một lần — lưu lại ngay.</li>
            <li>Nạp tiền vào ví BNTGame của bạn (đơn API trừ từ ví này).</li>
            <li>Gọi API với header xác thực bên dưới. Base URL: <code>{BASE}</code></li>
          </ol>
        </section>

        <section className="docs-sec">
          <h3>Xác thực</h3>
          <p>Mọi yêu cầu phải kèm API key theo một trong hai cách:</p>
          <Code>{`Authorization: Bearer bntg_live_xxxxxxxxxxxxxxxxxxxxxxxx
# hoặc
X-Api-Key: bntg_live_xxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
          <p>Khoá bị thu hồi hoặc tài khoản bị khoá sẽ nhận <code>401 UNAUTHORIZED</code>. Giới hạn tốc độ: <strong>240 yêu cầu/phút</strong> cho mỗi khoá (vượt quá nhận <code>429 RATE_LIMITED</code>).</p>
        </section>

        <section className="docs-sec">
          <h3>Quy ước chung</h3>
          <ul className="docs-list">
            <li>Định dạng JSON. Thành công: <code>{`{ "ok": true, "data": { ... } }`}</code> — Lỗi: <code>{`{ "ok": false, "error": { "code": "...", "message": "..." } }`}</code>.</li>
            <li>Mọi số tiền là <strong>USD cent</strong> (100 = $1.00), trường <code>currency</code> luôn là <code>USD</code>.</li>
            <li>Chỉ gọi qua HTTPS. Giữ khoá bí mật phía máy chủ của bạn — không nhúng khoá vào mã nguồn phía trình duyệt/app công khai.</li>
          </ul>
        </section>

        <Endpoint method="GET" path="/games" title="Danh mục game và gói đang bán, kèm định nghĩa các trường nạp (fields) của từng game để bạn biết cần gửi gì khi tạo đơn.">
          <Code>{`curl ${BASE}/games -H "Authorization: Bearer <API_KEY>"`}</Code>
          <Code>{`{
  "ok": true,
  "data": {
    "games": [
      {
        "id": 12, "slug": "free-fire", "name": "Free Fire", "genre": "Battle Royale",
        "regions": ["Việt Nam"],
        "fields": [{ "key": "uid", "label": "UID", "required": true }],
        "methodFields": {},
        "packages": [
          { "id": 301, "name": "25 Kim cương", "region": "Việt Nam", "method": "UID",
            "priceCents": 21, "listPriceCents": 25, "currency": "USD" }
        ]
      }
    ]
  }
}`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/balance" title="Số dư ví và điểm hiện tại của tài khoản sở hữu khoá.">
          <Code>{`curl ${BASE}/balance -H "Authorization: Bearer <API_KEY>"

{ "ok": true, "data": { "balanceCents": 125000, "points": 340, "currency": "USD" } }`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/orders" title="Tạo đơn nạp và trừ tiền từ ví. Đơn được xử lý tự động ngay sau khi tạo.">
          <div className="docs-table-wrap">
            <table className="docs-table">
              <thead><tr><th>Tham số</th><th>Bắt buộc</th><th>Mô tả</th></tr></thead>
              <tbody>
                <tr><td><code>packageId</code></td><td>Có</td><td>ID gói lấy từ <code>GET /games</code></td></tr>
                <tr><td><code>qty</code></td><td>Không</td><td>Số lượng 1–10, mặc định 1</td></tr>
                <tr><td><code>fields</code></td><td>Theo gói</td><td>Thông tin nạp của khách (vd <code>{`{ "uid": "512345678" }`}</code>) — các trường bắt buộc xem ở <code>fields</code>/<code>methodFields</code> của game</td></tr>
                <tr><td><code>promoCode</code></td><td>Không</td><td>Mã giảm giá của web</td></tr>
                <tr><td><code>clientRef</code></td><td>Không</td><td>Mã tham chiếu của hệ thống bạn (4–64 ký tự chữ/số, <code>-</code>, <code>_</code>). Gửi lại cùng <code>clientRef</code> sẽ trả về đơn cũ thay vì tạo đơn mới — dùng để chống trùng đơn khi mạng chập chờn</td></tr>
              </tbody>
            </table>
          </div>
          <Code>{`curl -X POST ${BASE}/orders \\
  -H "Authorization: Bearer <API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{ "packageId": 301, "qty": 1, "fields": { "uid": "512345678" }, "clientRef": "DH-2026-0001" }'`}</Code>
          <Code>{`{
  "ok": true,
  "data": {
    "order": {
      "code": "NAP100123", "status": "PROCESSING",
      "totalCents": 21, "discountCents": 0, "currency": "USD",
      "clientRef": "DH-2026-0001", "createdAt": "2026-11-24T15:04:05.000Z",
      "items": [{ "packageId": 301, "qty": 1, "priceCents": 21, "status": "PROCESSING", "fields": { "uid": "512345678" } }]
    },
    "duplicated": false
  }
}`}</Code>
          <p>HTTP 201 khi tạo mới; gọi lại với cùng <code>clientRef</code> trả HTTP 200 và <code>"duplicated": true</code>.</p>
        </Endpoint>

        <Endpoint method="GET" path="/orders/{code}" title="Tra trạng thái một đơn theo mã đơn (NAPxxxxxx) của chính tài khoản bạn.">
          <Code>{`curl ${BASE}/orders/NAP100123 -H "Authorization: Bearer <API_KEY>"`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/orders" title="Danh sách 20 đơn gần nhất của tài khoản.">
          <Code>{`curl ${BASE}/orders -H "Authorization: Bearer <API_KEY>"`}</Code>
        </Endpoint>

        <section className="docs-sec">
          <h3>Trạng thái đơn</h3>
          <div className="docs-table-wrap">
            <table className="docs-table">
              <thead><tr><th>Trạng thái</th><th>Ý nghĩa</th></tr></thead>
              <tbody>
                <tr><td><code>PENDING</code></td><td>Đơn vừa tạo, đang chờ xử lý</td></tr>
                <tr><td><code>PROCESSING</code></td><td>Đang nạp cho khách</td></tr>
                <tr><td><code>PARTIAL</code></td><td>Đã giao một phần</td></tr>
                <tr><td><code>DELIVERED</code></td><td>Đã giao thành công</td></tr>
                <tr><td><code>FAILED</code></td><td>Nạp thất bại — tiền được xử lý hoàn theo chính sách</td></tr>
                <tr><td><code>REFUNDED</code></td><td>Đã hoàn tiền về ví</td></tr>
                <tr><td><code>CANCELLED</code></td><td>Đơn đã huỷ</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="docs-sec">
          <h3>Mã lỗi</h3>
          <div className="docs-table-wrap">
            <table className="docs-table">
              <thead><tr><th>HTTP</th><th>code</th><th>Ý nghĩa</th></tr></thead>
              <tbody>
                <tr><td>400</td><td><code>BAD_JSON</code> / <code>BAD_PACKAGE</code> / <code>BAD_QTY</code> / <code>BAD_FIELDS</code> / <code>BAD_CLIENT_REF</code></td><td>Dữ liệu gửi lên không hợp lệ</td></tr>
                <tr><td>400</td><td><code>PACKAGE_UNAVAILABLE</code></td><td>Gói không tồn tại hoặc đang tắt</td></tr>
                <tr><td>400</td><td><code>MISSING_FIELD</code></td><td>Thiếu trường nạp bắt buộc của gói</td></tr>
                <tr><td>400</td><td><code>PROMO_INVALID</code></td><td>Mã giảm giá không hợp lệ / không đủ điều kiện</td></tr>
                <tr><td>401</td><td><code>UNAUTHORIZED</code></td><td>API key sai, đã thu hồi, hoặc tài khoản bị khoá</td></tr>
                <tr><td>402</td><td><code>INSUFFICIENT_BALANCE</code></td><td>Số dư ví không đủ</td></tr>
                <tr><td>404</td><td><code>ORDER_NOT_FOUND</code></td><td>Không có đơn với mã này thuộc tài khoản của bạn</td></tr>
                <tr><td>409</td><td><code>FLASH_SOLD_OUT</code></td><td>Suất giá Flash Sale của gói đã hết</td></tr>
                <tr><td>429</td><td><code>RATE_LIMITED</code></td><td>Quá 240 yêu cầu/phút cho khoá này</td></tr>
                <tr><td>500</td><td><code>ORDER_FAILED</code></td><td>Lỗi hệ thống khi tạo đơn — thử lại (dùng <code>clientRef</code> để tránh trùng)</td></tr>
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 14 }}>Cần hỗ trợ tích hợp? Vào <Link href="/support"><strong>Kênh hỗ trợ</strong></Link> và gửi ticket kèm mã đơn/khoá (chỉ gửi 17 ký tự đầu của khoá, không gửi toàn bộ khoá).</p>
        </section>
      </div>
    </main>
  );
}
