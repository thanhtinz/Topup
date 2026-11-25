import http from "node:http";
import { prisma } from "../src/lib/db";
import { encryptSecret } from "../src/lib/crypto";
import { buyPackage } from "../src/lib/orders";
import { assertTestDb } from "./guard";

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ order: { id: "mock-1", status: "completed" } }));
  });
});

async function balance(userId: number) {
  return (await prisma.user.findUnique({ where: { id: userId }, select: { balanceCents: true } }))!.balanceCents;
}
async function sold(itemId: number) {
  return (await prisma.flashSaleItem.findUnique({ where: { id: itemId }, select: { soldCount: true } }))!.soldCount;
}

async function main() {
  assertTestDb();
  await new Promise<void>((r) => server.listen(3997, r));
  const user = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!user) throw new Error("no demo user");
  const userId = user.id;
  await prisma.user.update({ where: { id: userId }, data: { balanceCents: 100000 } });

  const origProvider = await prisma.provider.findUnique({ where: { code: "FZR" } });
  await prisma.provider.upsert({
    where: { code: "FZR" },
    create: { code: "FZR", name: "FZR", enabled: true, baseUrl: "http://127.0.0.1:3997", apiKeyEnc: encryptSecret("test-key") },
    update: { enabled: true, baseUrl: "http://127.0.0.1:3997", apiKeyEnc: encryptSecret("test-key") },
  });

  const game = await prisma.game.findFirst({ where: { active: true }, orderBy: { id: "asc" } });
  if (!game) throw new Error("no game");
  const pkg = await prisma.package.create({
    data: { gameId: game.id, name: "FLASH STOCK PACK", priceCents: 500, costCents: 150, provider: "FZR", externalId: "cat1::offer1", active: true },
  });
  const now = Date.now();
  const sale = await prisma.flashSale.create({
    data: { name: "FLASH TEST", startsAt: new Date(now - 3600_000), endsAt: new Date(now + 3600_000), active: true },
  });
  const item = await prisma.flashSaleItem.create({
    data: { flashSaleId: sale.id, packageId: pkg.id, salePriceCents: 400, stockLimit: 3, soldCount: 0 },
  });
  const fieldsDef = (game.fieldsJson as Array<{ key: string; required: boolean }> | null) ?? [];
  const fields: Record<string, string> = {};
  for (const f of fieldsDef) if (f.required) fields[f.key] = "testvalue";
  const mf = (game.methodFieldsJson as Record<string, Array<{ key: string; required: boolean }>> | null) ?? {};
  for (const arr of Object.values(mf)) for (const f of arr) if (f.required) fields[f.key] = "testvalue";

  let allOk = true;
  async function tryBuy(qty: number) {
    try {
      const o = await buyPackage({ userId, packageId: pkg.id, qty, fields });
      return { ok: true, id: o.id };
    } catch (e) {
      return { ok: false, err: (e as Error).message };
    }
  }

  const b1 = await tryBuy(2);
  const s1 = await sold(item.id);
  const ok1 = b1.ok && s1 === 2;
  console.log(`buy qty2 of 3: ok=${b1.ok} soldCount=${s1}`, ok1 ? "OK" : "FAIL");
  allOk = allOk && ok1;

  const balBefore = await balance(userId);
  const b2 = await tryBuy(2);
  const s2 = await sold(item.id);
  const balAfter = await balance(userId);
  const ok2 = !b2.ok && b2.err === "FLASH_SOLD_OUT" && s2 === 2 && balAfter === balBefore;
  console.log(`buy qty2 with 1 left: err=${b2.err} soldCount=${s2} balanceUnchanged=${balAfter === balBefore}`, ok2 ? "OK" : "FAIL");
  allOk = allOk && ok2;

  const b3 = await tryBuy(1);
  const s3 = await sold(item.id);
  const ok3 = b3.ok && s3 === 3;
  console.log(`buy qty1 last slot: ok=${b3.ok} soldCount=${s3}`, ok3 ? "OK" : "FAIL");
  allOk = allOk && ok3;

  const b4 = await tryBuy(1);
  const o4items = b4.id ? await prisma.orderItem.findMany({ where: { orderId: b4.id }, select: { flashItemId: true } }) : [];
  const ok4 = b4.ok && o4items.length > 0 && o4items.every((i) => i.flashItemId === null) && (await sold(item.id)) === 3;
  console.log(`buy qty1 after sellout: ok=${b4.ok} flashLinked=${o4items.some((i) => i.flashItemId !== null)} soldCount=${await sold(item.id)}`, ok4 ? "OK" : "FAIL");
  allOk = allOk && ok4;

  await prisma.flashSaleItem.update({ where: { id: item.id }, data: { soldCount: 2 } });
  const race = await Promise.all([tryBuy(1), tryBuy(1), tryBuy(1)]);
  const raceItems = await prisma.orderItem.findMany({
    where: { orderId: { in: race.filter((r) => r.id).map((r) => r.id!) } },
    select: { flashItemId: true, qty: true },
  });
  const flashUnits = raceItems.filter((i) => i.flashItemId === item.id).reduce((s, i) => s + i.qty, 0);
  const soldAfterRace = await sold(item.id);
  const ok5 = soldAfterRace === 3 && flashUnits === 1;
  console.log(`race 3 buys for last slot: flashUnitsSold=${flashUnits} soldCount=${soldAfterRace}`, ok5 ? "OK" : "FAIL");
  allOk = allOk && ok5;

  console.log(allOk ? "ALL OK" : "SOME FAILED");

  await prisma.orderItem.deleteMany({ where: { packageId: pkg.id } });
  await prisma.order.deleteMany({ where: { items: { some: { packageId: pkg.id } } } });
  await prisma.flashSaleItem.delete({ where: { id: item.id } });
  await prisma.flashSale.delete({ where: { id: sale.id } });
  await prisma.package.delete({ where: { id: pkg.id } });
  if (origProvider) {
    await prisma.provider.update({ where: { code: "FZR" }, data: { enabled: origProvider.enabled, baseUrl: origProvider.baseUrl, apiKeyEnc: origProvider.apiKeyEnc } });
  } else {
    await prisma.provider.delete({ where: { code: "FZR" } });
  }
  server.close();
  await prisma.$disconnect();
  process.exit(allOk ? 0 : 1);
}
main().catch(async (e) => { console.error(e); server.close(); await prisma.$disconnect(); process.exit(1); });
