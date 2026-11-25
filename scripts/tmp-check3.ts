import { prisma } from "../src/lib/db";
async function main() {
  const gs = await prisma.game.findMany({ where: { active: true, bannerUrl: { not: null } }, select: { slug: true, name: true, cover: true }, take: 6 });
  console.log(gs.map((g) => g.slug).join("\n"));
  await prisma.$disconnect();
}
main();
