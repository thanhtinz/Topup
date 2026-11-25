import { prisma } from "../src/lib/db";
async function main() {
  const g = await prisma.game.findUnique({ where: { slug: "age-of-empire-mobile" }, select: { id: true, ratingAvg: true, ratingCount: true } });
  console.log("game:", g);
  const n = await prisma.review.count({ where: { gameId: g?.id } });
  console.log("reviews for game:", n);
  const all = await prisma.review.findMany({ select: { id: true, gameId: true, stars: true }, take: 5 });
  console.log("sample reviews:", all);
  await prisma.$disconnect();
}
main();
