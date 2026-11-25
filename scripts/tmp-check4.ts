import { prisma } from "../src/lib/db";
async function main() {
  const g = await prisma.game.findUnique({ where: { slug: "genshin-impact" }, select: { bannerUrl: true } });
  console.log(g?.bannerUrl);
  await prisma.$disconnect();
}
main();
