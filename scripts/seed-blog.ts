import { prisma } from "../src/lib/db";
async function main() {
  const posts = [
    {
      slug: "chao-mung-bntgame", category: "TIN_TUC", title: "Chào mừng bạn đến với BNTGame",
      excerpt: "BNTGame — nạp game tự động, giao ngay trong vài giây, hỗ trợ hàng trăm game phổ biến.",
      content: "BNTGame là nền tảng nạp game tự động: chọn game, chọn gói, nhập UID/Server và thanh toán bằng ví — hệ thống nạp thẳng vào tài khoản game của bạn trong vài giây.\n\nMọi đơn hàng đều theo dõi được tiến trình ngay trong trang tài khoản, kèm thông báo khi giá giảm và các đợt Flash Sale theo khung giờ.\n\nCảm ơn bạn đã đồng hành cùng BNTGame!",
    },
    {
      slug: "huong-dan-tim-uid-free-fire", category: "HUONG_DAN", title: "Hướng dẫn tìm UID trong Free Fire",
      excerpt: "UID là dãy số định danh tài khoản Free Fire của bạn — xem ngay trong hồ sơ nhân vật, chỉ mất 10 giây.",
      content: "Bước 1: Mở Free Fire và vào màn hình chính.\n\nBước 2: Bấm vào ảnh đại diện ở góc trên bên trái để mở Hồ sơ nhân vật.\n\nBước 3: UID là dãy số hiển thị ngay dưới tên nhân vật. Sao chép dãy số này và dán vào ô UID khi nạp tại BNTGame.\n\nLưu ý: nạp bằng UID không cần mật khẩu tài khoản — tuyệt đối không chia sẻ mật khẩu game cho bất kỳ ai.",
    },
  ];
  for (const p of posts) {
    await prisma.post.upsert({ where: { slug: p.slug }, create: { ...p, published: true, publishedAt: new Date() }, update: {} });
  }
  console.log("posts:", await prisma.post.count());
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
