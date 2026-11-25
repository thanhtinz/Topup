import { prisma } from "../src/lib/db";
async function main() {
  const g = await prisma.game.findUnique({ where: { slug: "genshin-impact" } });
  if (!g) throw new Error("no game");
  const r = await prisma.package.updateMany({ where: { gameId: g.id }, data: { method: "Login" } });
  console.log("flipped:", r.count);
  await prisma.$disconnect();
}
main();
