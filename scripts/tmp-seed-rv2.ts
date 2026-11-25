import { prisma } from "../src/lib/db";
async function main() {
  const g = await prisma.game.findUnique({ where: { slug: "genshin-impact" } });
  if (!g) throw new Error("no game");
  let u = await prisma.user.findFirst({ where: { email: "demo@bnttopup.local" } });
  if (!u) throw new Error("no demo user");
  const stars = [5, 5, 4];
  for (let i = 0; i < stars.length; i++) {
    const code = `RV-DEMO-${i + 1}`;
    const ex = await prisma.order.findFirst({ where: { code } });
    if (ex) continue;
    const o = await prisma.order.create({ data: { code, userId: u.id, gameId: g.id, status: "DELIVERED", totalCents: 99 } });
    await prisma.review.create({ data: { orderId: o.id, gameId: g.id, userId: u.id, stars: stars[i], comment: "Nạp nhanh, giá tốt.", pointsAwarded: 2 } });
  }
  const agg = await prisma.review.aggregate({ where: { gameId: g.id }, _avg: { stars: true }, _count: true });
  await prisma.game.update({ where: { id: g.id }, data: { ratingAvg: agg._avg.stars ?? 0, ratingCount: agg._count } });
  console.log("reviews seeded:", agg._count, "avg:", agg._avg.stars);
  await prisma.$disconnect();
}
main();
