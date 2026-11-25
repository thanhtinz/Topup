import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const revert = process.argv[2] === "revert";
  if (revert) {
    const r = await prisma.package.updateMany({ where: { provider: { in: ["FZR", "ERIS"] } }, data: { provider: "MANUAL" } });
    await prisma.game.updateMany({ where: { id: { in: [1, 2] } }, data: { compareApproved: true } });
    console.log("đã trả về MANUAL:", r.count, "gói, duyệt so sánh trả về true");
    return;
  }
  await prisma.game.updateMany({ where: { id: { in: [1, 2] } }, data: { compareApproved: false } });
  for (const gameId of [1, 2]) {
    const pkgs = await prisma.package.findMany({ where: { gameId }, orderBy: { id: "asc" } });
    for (let i = 0; i < pkgs.length; i++) {
      const toEris = i % 2 === 1;
      const cheaperIsEris = gameId === 1;
      const cost = pkgs[i].costCents;
      const newCost = toEris === cheaperIsEris ? Math.max(1, Math.round(cost * 0.9)) : cost;
      await prisma.package.update({ where: { id: pkgs[i].id }, data: { provider: toEris ? "ERIS" : "FZR", costCents: newCost } });
    }
    console.log("game", gameId, "đã gán tạm", pkgs.length, "gói");
  }
}
main().then(() => prisma.$disconnect());
