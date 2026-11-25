import { prisma } from "../src/lib/db";
import { buyPackage } from "../src/lib/orders";
import { assertTestDb } from "./guard";

async function main() {
  assertTestDb();
  const user = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!user) throw new Error("no demo user");
  const userId = user.id;
  await prisma.user.update({ where: { id: userId }, data: { balanceCents: 100000 } });
  const game = await prisma.game.findFirst({ where: { active: true }, orderBy: { id: "asc" } });
  if (!game) throw new Error("no game");
  const pkg = await prisma.package.create({
    data: { gameId: game.id, name: "IDEM TEST PACK", priceCents: 1000, costCents: 800, provider: "MANUAL", externalId: null, active: true },
  });
  const fieldsDef = (game.fieldsJson as Array<{ key: string; required: boolean }> | null) ?? [];
  const fields: Record<string, string> = {};
  for (const f of fieldsDef) if (f.required) fields[f.key] = "testvalue";
  const mf = (game.methodFieldsJson as Record<string, Array<{ key: string; required: boolean }>> | null) ?? {};
  for (const arr of Object.values(mf)) for (const f of arr) if (f.required) fields[f.key] = "testvalue";

  const bal = async () => (await prisma.user.findUnique({ where: { id: userId }, select: { balanceCents: true } }))!.balanceCents;
  const ref = "web_testidem123456";
  const start = await bal();
  const o1 = await buyPackage({ userId, packageId: pkg.id, qty: 1, fields, clientRef: ref });
  const o2 = await buyPackage({ userId, packageId: pkg.id, qty: 1, fields, clientRef: ref });
  const afterSeq = await bal();
  console.log("sequential dup:", o1.id === o2.id && afterSeq === start - o1.totalCents ? "OK" : `FAIL ids ${o1.id}/${o2.id} bal ${start}->${afterSeq}`);

  const ref2 = "web_testidem concurrent".replace(" ", "_");
  const [c1, c2] = await Promise.all([
    buyPackage({ userId, packageId: pkg.id, qty: 1, fields, clientRef: ref2 }),
    buyPackage({ userId, packageId: pkg.id, qty: 1, fields, clientRef: ref2 }),
  ]);
  const afterConc = await bal();
  const count = await prisma.order.count({ where: { userId, clientRef: ref2 } });
  console.log("concurrent dup:", c1.id === c2.id && count === 1 && afterConc === afterSeq - c1.totalCents ? "OK" : `FAIL ids ${c1.id}/${c2.id} count ${count} bal ${afterConc}`);

  const mine = await prisma.order.findMany({ where: { userId, clientRef: { in: [ref, ref2] } }, select: { id: true } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: mine.map((o) => o.id) } } });
  await prisma.order.deleteMany({ where: { id: { in: mine.map((o) => o.id) } } });
  await prisma.orderItem.deleteMany({ where: { packageId: pkg.id } });
  await prisma.package.delete({ where: { id: pkg.id } });
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
