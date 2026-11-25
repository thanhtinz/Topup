import { prisma } from "../src/lib/db";
async function main() {
  const ff = await prisma.game.findFirst({ where: { name: "Free Fire" } });
  const pkgs = ff ? await prisma.package.findMany({ where: { gameId: ff.id, name: { in: ["100 Diamonds", "5,600 Diamonds", "113 Diamonds"] } }, select: { name: true, imageUrl: true } }) : [];
  console.log("FF pkgs:", JSON.stringify(pkgs));
  const aov = await prisma.game.findFirst({ where: { name: "Arena of Valor" }, select: { cover: true, bannerUrl: true, genre: true } });
  console.log("AoV:", JSON.stringify(aov));
  await prisma.$disconnect();
}
main();
