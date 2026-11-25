import { prisma } from "../src/lib/db";
async function main() {
  const g = await prisma.game.findUnique({ where: { slug: "genshin-impact" } });
  if (!g) throw new Error("no game");
  const names = ["60 Genesis Crystals", "300+30 Genesis Crystals", "980+110 Genesis Crystals", "Blessing of the Welkin Moon", "Welkin Moon + 300 Crystals Combo"];
  for (const nm of names) {
    const ex = await prisma.package.findFirst({ where: { gameId: g.id, name: nm } });
    if (!ex) await prisma.package.create({ data: { gameId: g.id, name: nm, region: "Global", method: "Login", costCents: 90, priceCents: 99, provider: "MANUAL", active: true } });
  }
  console.log("seeded tabs demo");
  await prisma.$disconnect();
}
main();
