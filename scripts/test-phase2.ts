import { prisma } from "../src/lib/db";
import { buyPackage } from "../src/lib/orders";
import { toggleGameNotify, checkGamePriceDrop } from "../src/lib/engage";

async function main() {
  const demo = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!demo) throw new Error("no demo user");
  const pkg = await prisma.package.findFirst({ where: { id: 1 }, include: { game: true } });
  if (!pkg) throw new Error("no pkg 1");
  console.log("PKG:", pkg.game.name, pkg.name, pkg.priceCents, "demo balance:", demo.balanceCents, "points:", demo.points);

  await prisma.flashSale.deleteMany({ where: { name: "TEST P2" } });
  await prisma.user.update({ where: { id: demo.id }, data: { balanceCents: 100000 } });

  const now = new Date();
  const sale = await prisma.flashSale.create({
    data: {
      name: "TEST P2", startsAt: new Date(now.getTime() - 3600e3), endsAt: new Date(now.getTime() + 3600e3), active: true,
      items: { create: { packageId: pkg.id, salePriceCents: 4, stockLimit: 2 } },
    },
    include: { items: true },
  });
  const itemId = sale.items[0].id;

  const o1 = await buyPackage({ userId: demo.id, packageId: pkg.id, qty: 1, fields: { uid: "55667788", server: "VN" } });
  const oi1 = await prisma.orderItem.findFirst({ where: { orderId: o1.id } });
  const it1 = await prisma.flashSaleItem.findUnique({ where: { id: itemId } });
  console.log("BUY1:", o1.code, "itemPrice:", oi1?.priceCents, "flashItemId:", oi1?.flashItemId === itemId, "soldCount:", it1?.soldCount);

  await buyPackage({ userId: demo.id, packageId: pkg.id, qty: 1, fields: { uid: "55667788", server: "VN" } });
  const it2 = await prisma.flashSaleItem.findUnique({ where: { id: itemId } });
  console.log("BUY2 soldCount:", it2?.soldCount);

  let soldOut = "";
  try {
    await buyPackage({ userId: demo.id, packageId: pkg.id, qty: 1, fields: { uid: "55667788", server: "VN" } });
  } catch (e) {
    soldOut = e instanceof Error ? e.message : String(e);
  }
  const demoAfter = await prisma.user.findUnique({ where: { id: demo.id }, select: { balanceCents: true } });
  console.log("BUY3 (phải FLASH_SOLD_OUT hoặc giá thường nếu hết flash):", soldOut || "không lỗi", "balance:", demoAfter?.balanceCents);

  const on = await toggleGameNotify(demo.id, pkg.gameId);
  const fired1 = await checkGamePriceDrop(pkg.gameId, pkg.name, 600, 500);
  const fired2 = await checkGamePriceDrop(pkg.gameId, pkg.name, 500, 400);
  const notif = await prisma.notification.findFirst({ where: { userId: demo.id, link: `/game/${pkg.game.slug}` }, orderBy: { createdAt: "desc" } });
  console.log("NOTIFY: subbed:", on, "fired1:", fired1, "fired2 (spam guard):", fired2, "latest:", notif?.title);

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
    await prisma.post.upsert({ where: { slug: p.slug }, create: { ...p, published: true, publishedAt: new Date() }, update: { ...p, published: true } });
  }
  console.log("BLOG seeded:", await prisma.post.count({ where: { published: true } }));

  await prisma.flashSale.delete({ where: { id: sale.id } });
  console.log("DONE");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
