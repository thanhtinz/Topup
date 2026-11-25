import { prisma } from "../src/lib/db";
async function main() {
  const game = await prisma.game.findFirst({ where: { active: true, slug: { contains: "mobile" } }, include: { packages: { where: { active: true }, take: 1 } } })
    ?? await prisma.game.findFirst({ where: { active: true }, include: { packages: { where: { active: true }, take: 1 } } });
  if (!game || !game.packages.length) throw new Error("no game");
  const demo = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!demo) throw new Error("no demo");
  const u2 = await prisma.user.upsert({ where: { email: "lan@bnttopup.local" }, update: {}, create: { email: "lan@bnttopup.local", name: "Lan Anh", passwordHash: "x" } });
  const u3 = await prisma.user.upsert({ where: { email: "minh@bnttopup.local" }, update: {}, create: { email: "minh@bnttopup.local", name: "Minh Quân", passwordHash: "x" } });
  const mkOrder = async (userId: number, code: string) => prisma.order.create({ data: { code, userId, gameId: game.id, totalCents: 500, status: "DELIVERED", items: { create: [{ packageId: game.packages[0].id, qty: 1, priceCents: 500 }] } } });
  const o2 = await mkOrder(u2.id, "TEST-RV-002");
  const o3 = await mkOrder(u3.id, "TEST-RV-003");
  await prisma.review.create({ data: { userId: u2.id, orderId: o2.id, gameId: game.id, stars: 5, comment: "Nạp nhanh, 5 giây là kim cương về tài khoản. Giá rẻ hơn nạp trực tiếp.", pointsAwarded: 2 } });
  await prisma.review.create({ data: { userId: u3.id, orderId: o3.id, gameId: game.id, stars: 4, comment: "Ổn, giao hơi chậm lúc cao điểm nhưng vẫn trong 1 phút.", pointsAwarded: 2 } });
  const agg = await prisma.review.aggregate({ where: { gameId: game.id }, _avg: { stars: true }, _count: { _all: true } });
  await prisma.game.update({ where: { id: game.id }, data: { ratingAvg: Math.round((agg._avg.stars ?? 0) * 10) / 10, ratingCount: agg._count._all } });
  const mine = await mkOrder(demo.id, "TEST-RV-001");
  console.log("game:", game.slug, "| demo order:", mine.code, "| reviews:", agg._count._all, "avg:", agg._avg.stars);
  await prisma.$disconnect();
}
main();
