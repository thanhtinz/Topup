import http from "node:http";
import { prisma } from "../src/lib/db";
import { encryptSecret } from "../src/lib/crypto";
import { buyPackage } from "../src/lib/orders";
import { assertTestDb } from "./guard";

let calls = 0;
let failFrom = Number.MAX_SAFE_INTEGER;
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    calls++;
    const key = String(req.headers["idempotency-key"] ?? "");
    const idx = parseInt(key.split("-").pop() ?? "0", 10);
    if (idx >= failFrom) {
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
  await new Promise<void>((r) => server.listen(3999, r));
  const user = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!user) throw new Error("no demo user");
  const userId = user.id;
  await prisma.user.update({ where: { id: userId }, data: { balanceCents: 100000 } });

  const origProvider = await prisma.provider.findUnique({ where: { code: "FZR" } });
  await prisma.provider.upsert({
    where: { code: "FZR" },
    create: { code: "FZR", name: "FZR", enabled: true, baseUrl: "http://127.0.0.1:3999", apiKeyEnc: encryptSecret("test-key") },
    update: { enabled: true, baseUrl: "http://127.0.0.1:3999", apiKeyEnc: encryptSecret("test-key") },
  });

  const game = await prisma.game.findFirst({ where: { active: true }, orderBy: { id: "asc" } });
  if (!game) throw new Error("no game");
  const pkg = await prisma.package.create({
    data: { gameId: game.id, name: "QTY TEST PACK", priceCents: 200, costCents: 150, provider: "FZR", externalId: "cat1::offer1", active: true },
  });
  const fieldsDef = (game.fieldsJson as Array<{ key: string; required: boolean }> | null) ?? [];
  const fields: Record<string, string> = {};
  for (const f of fieldsDef) if (f.required) fields[f.key] = "testvalue";
  const mf = (game.methodFieldsJson as Record<string, Array<{ key: string; required: boolean }>> | null) ?? {};
  for (const arr of Object.values(mf)) for (const f of arr) if (f.required) fields[f.key] = "testvalue";

  async function scenario(name: string, qty: number, failAt: number, expectStatus: string, expectKeptUnits: number) {
    calls = 0;
    failFrom = failAt;
    const start = await balance(userId);
    const order = await buyPackage({ userId, packageId: pkg.id, qty, fields });
    const after = await prisma.order.findUnique({ where: { id: order.id } });
    const bal = await balance(userId);
    const kept = Math.floor(((after?.totalCents ?? 0) * expectKeptUnits) / qty);
    const expectBal = start - (after?.totalCents ?? 0) + ((after?.totalCents ?? 0) - kept);
    const ok = after?.status === expectStatus && bal === expectBal && calls === Math.min(qty, failAt === Number.MAX_SAFE_INTEGER ? qty : failAt);
    console.log(`${name}: status=${after?.status} calls=${calls} balance ${start}->${bal} expected ${expectBal}`, ok ? "OK" : "FAIL");
    return ok;
  }

  let allOk = true;
  allOk = (await scenario("qty3 all delivered", 3, Number.MAX_SAFE_INTEGER, "DELIVERED", 3)) && allOk;
  allOk = (await scenario("qty3 fail at unit3", 3, 3, "PARTIAL", 2)) && allOk;
  allOk = (await scenario("qty2 fail at unit1", 2, 1, "REFUNDED", 0)) && allOk;
  console.log(allOk ? "ALL OK" : "SOME FAILED");

  await prisma.orderItem.deleteMany({ where: { packageId: pkg.id } });
  await prisma.order.deleteMany({ where: { items: { some: { packageId: pkg.id } } } });
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
