import { prisma } from "../src/lib/db";
import { assertTestDb } from "./guard";

async function main() {
  assertTestDb();
  const u = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!u) throw new Error("no demo user");
  const g = await prisma.game.findFirst({ where: { active: true }, orderBy: { id: "asc" } });
  if (!g) throw new Error("no game");
  const p = await prisma.package.findFirst({ where: { gameId: g.id, active: true } });
  if (!p) throw new Error("no package");
  await prisma.order.deleteMany({ where: { code: "STAFFTEST1" } });
  const o = await prisma.order.create({
    data: {
      code: "STAFFTEST1",
      userId: u.id,
      gameId: g.id,
      totalCents: 500,
      status: "PROCESSING",
      items: { create: { packageId: p.id, qty: 1, priceCents: 500, fieldsJson: {}, status: "PROCESSING" } },
    },
  });
  console.log("order id", o.id);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
