import { prisma } from "../src/lib/db";
import { buyPackage } from "../src/lib/orders";
import { setSetting } from "../src/lib/settings";
import { assertTestDb } from "./guard";

async function main() {
  assertTestDb();
  const user = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!user) throw new Error("no demo user");
  const userId = user.id;
  await prisma.user.update({ where: { id: userId }, data: { balanceCents: 100000 } });
  await setSetting("module_discount", "1");

  const game = await prisma.game.findFirst({ where: { active: true }, orderBy: { id: "asc" } });
  if (!game) throw new Error("no game");
  const pkg = await prisma.package.create({
    data: { gameId: game.id, name: "PROMO TEST PACK", priceCents: 1000, costCents: 800, provider: "MANUAL", externalId: null, active: true },
  });
  const fieldsDef = (game.fieldsJson as Array<{ key: string; required: boolean }> | null) ?? [];
  const fields: Record<string, string> = {};
  for (const f of fieldsDef) if (f.required) fields[f.key] = "testvalue";
  const mf = (game.methodFieldsJson as Record<string, Array<{ key: string; required: boolean }>> | null) ?? {};
  for (const arr of Object.values(mf)) for (const f of arr) if (f.required) fields[f.key] = "testvalue";

  const code = "RACETEST1";
  await prisma.discountCode.upsert({
    where: { code },
    create: { code, percent: 10, maxUses: 1, usedCount: 0, active: true },
    update: { percent: 10, maxUses: 1, usedCount: 0, active: true },
  });

  const attempt = () => buyPackage({ userId, packageId: pkg.id, qty: 1, fields, promoCode: code });
  const results = await Promise.allSettled([attempt(), attempt(), attempt()]);
  const okCount = results.filter((r) => r.status === "fulfilled").length;
  const promoErr = results.filter((r) => r.status === "rejected" && String((r as PromiseRejectedResult).reason?.message ?? "") === "PROMO_INVALID").length;
  const after = await prisma.discountCode.findUnique({ where: { code } });
  console.log(`succeeded: ${okCount}/3, PROMO_INVALID: ${promoErr}, usedCount: ${after?.usedCount}`,
    okCount === 1 && after?.usedCount === 1 ? "OK" : "FAIL");

  const orders = await prisma.order.findMany({ where: { promoCode: code }, select: { id: true } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } });
  await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
  await prisma.package.delete({ where: { id: pkg.id } });
  await prisma.discountCode.delete({ where: { code } });
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
