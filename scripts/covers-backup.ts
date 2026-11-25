import { prisma } from "../src/lib/db";
async function main() {
  const mode = process.argv[2];
  if (mode === "clear") {
    const games = await prisma.game.findMany({ select: { id: true, cover: true, bannerUrl: true } });
    console.log(JSON.stringify(games));
    await prisma.game.updateMany({ data: { cover: "", bannerUrl: null } });
  } else if (mode === "restore") {
    const games = JSON.parse(process.argv[3] ?? "[]") as { id: number; cover: string; bannerUrl: string | null }[];
    for (const g of games) await prisma.game.update({ where: { id: g.id }, data: { cover: g.cover, bannerUrl: g.bannerUrl } });
    console.log("restored", games.length);
  }
  await prisma.$disconnect();
}
main();
