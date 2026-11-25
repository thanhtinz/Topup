import http from "node:http";
import { prisma } from "../src/lib/db";
import { encryptSecret } from "../src/lib/crypto";
import { buyPackage, refundOrder, failOrderWithRefund, partialRefund } from "../src/lib/orders";
import { assertTestDb } from "./guard";

let calls = 0;
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    calls++;
    const key = String(req.headers["idempotency-key"] ?? "");
    const idx = parseInt(key.split("-").pop() ?? "0", 10);
    if (idx >= 3) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "mock fail" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ order: { id: `mock-${idx}`, status: "completed" } }));
  });
});

async function balance(userId: number) {
  return (await prisma.user.findUnique({ where: { id: userId }, select: { balanceCents: true } }))!.balanceCents;
}

async function main() {
  assertTestDb();
  await new Promise<void>((r) => server.listen(3998, r));
  const user = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!user) throw new Error("no demo user");
  const userId = user.id;
  await prisma.user.update({ where: { id: userId }, data: { balanceCents: 100000 } });

  const origProvider = await prisma.provider.findUnique({ where: { code: "FZR" } });
  await prisma.provider.upsert({
    where: { code: "FZR" },
    create: { code: "FZR", name: "FZR", enabled: true, baseUrl: "http://127.0.0.1:3998", apiKeyEnc: encryptSecret("test-key") },
    update: { enabled: true, baseUrl: "http://127.0.0.1:3998", apiKeyEnc: encryptSecret("test-key") },
  });

  const game = await prisma.game.findFirst({ where: { active: true }, orderBy: { id: "asc" } });
  if (!game) throw new Error("no game");
  const pkg = await prisma.package.create({
    data: { gameId: game.id, name: "PARTIAL GUARD PACK", priceCents: 300, costCents: 150, provider: "FZR", externalId: "cat1::offer1", active: true },
  });
  const fieldsDef = (game.fieldsJson as Array<{ key: string; required: boolean }> | null) ?? [];
  const fields: Record<string, string> = {};
  for (const f of fieldsDef) if (f.required) fields[f.key] = "testvalue";
  const mf = (game.methodFieldsJson as Record<string, Array<{ key: string; required: boolean }>> | null) ?? {};
  for (const arr of Object.values(mf)) for (const f of arr) if (f.required) fields[f.key] = "testvalue";

  let allOk = true;
  const order = await buyPackage({ userId, packageId: pkg.id, qty: 3, fields });
  const afterBuy = await prisma.order.findUnique({ where: { id: order.id } });
  const balAfterBuy = await balance(userId);
  console.log(`after buy: status=${afterBuy?.status} balance=${balAfterBuy} total=${afterBuy?.totalCents}`);
  if (afterBuy?.status !== "PARTIAL") { console.log("FAIL: order should be PARTIAL"); allOk = false; }

  let threw = "";
  try { await refundOrder(order.id); } catch (e) { threw = (e as Error).message; }
  const balAfterRefundTry = await balance(userId);
  const statusAfterRefundTry = (await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } }))!.status;
  const ok1 = threw === "ORDER_NOT_REFUNDABLE" && balAfterRefundTry === balAfterBuy && statusAfterRefundTry === "PARTIAL";
  console.log(`refundOrder on PARTIAL: threw=${threw} balanceUnchanged=${balAfterRefundTry === balAfterBuy} status=${statusAfterRefundTry}`, ok1 ? "OK" : "FAIL");
  allOk = allOk && ok1;

  await failOrderWithRefund(order.id, userId, order.code);
  const balAfterFailTry = await balance(userId);
  const statusAfterFailTry = (await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } }))!.status;
  const ok2 = balAfterFailTry === balAfterBuy && statusAfterFailTry === "PARTIAL";
  console.log(`failOrderWithRefund on PARTIAL: balanceUnchanged=${balAfterFailTry === balAfterBuy} status=${statusAfterFailTry}`, ok2 ? "OK" : "FAIL");
  allOk = allOk && ok2;

  const fresh = await prisma.order.findUnique({ where: { id: order.id } });
  await partialRefund({ id: fresh!.id, userId: fresh!.userId, code: fresh!.code, totalCents: fresh!.totalCents, pointsUsed: fresh!.pointsUsed }, 2, 3);
  const balAfterSecondPartial = await balance(userId);
  const ok3 = balAfterSecondPartial === balAfterBuy;
  console.log(`second partialRefund: balanceUnchanged=${ok3}`, ok3 ? "OK" : "FAIL");
  allOk = allOk && ok3;

  console.log(allOk ? "ALL OK" : "SOME FAILED");

  await prisma.orderItem.deleteMany({ where: { packageId: pkg.id } });
  await prisma.order.deleteMany({ where: { items: { some: { packageId: pkg.id } } } });
  await prisma.order.deleteMany({ where: { id: order.id } });
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
