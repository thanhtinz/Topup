import http from "node:http";
import { prisma } from "../src/lib/db";
import { encryptSecret } from "../src/lib/crypto";
import { recoverStuckOrders } from "../src/lib/recovery";
import { assertTestDb } from "./guard";

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const key = String(req.headers["idempotency-key"] ?? "");
    if (key.includes("RCFAIL")) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "mock fail" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ order: { id: "mock-rc", status: "completed" } }));
  });
});

async function balance(userId: number) {
  return (await prisma.user.findUnique({ where: { id: userId }, select: { balanceCents: true } }))!.balanceCents;
}

async function main() {
  assertTestDb();
  await new Promise<void>((r) => server.listen(3996, r));
  const user = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!user) throw new Error("no demo user");
  const userId = user.id;
  await prisma.user.update({ where: { id: userId }, data: { balanceCents: 0 } });

  const origProvider = await prisma.provider.findUnique({ where: { code: "FZR" } });
  await prisma.provider.upsert({
    where: { code: "FZR" },
    create: { code: "FZR", name: "FZR", enabled: true, baseUrl: "http://127.0.0.1:3996", apiKeyEnc: encryptSecret("test-key") },
    update: { enabled: true, baseUrl: "http://127.0.0.1:3996", apiKeyEnc: encryptSecret("test-key") },
  });

  const game = await prisma.game.findFirst({ where: { active: true }, orderBy: { id: "asc" } });
  if (!game) throw new Error("no game");
  const pkgFzr = await prisma.package.create({
    data: { gameId: game.id, name: "RECOVERY FZR PACK", priceCents: 500, costCents: 150, provider: "FZR", externalId: "cat1::offer1", active: true },
  });
  const pkgEris = await prisma.package.create({
    data: { gameId: game.id, name: "RECOVERY ERIS PACK", priceCents: 500, costCents: 150, provider: "ERIS", externalId: "cat1::offer1", active: true },
  });

  const ago = (mins: number) => new Date(Date.now() - mins * 60_000);
  async function stuckOrder(code: string, packageId: number, totalCents: number, ageMins: number) {
    return prisma.order.create({
      data: {
        code, userId, gameId: game!.id, totalCents, status: "PROCESSING",
        createdAt: ago(ageMins), updatedAt: ago(ageMins),
        items: { create: { packageId, qty: 1, priceCents: totalCents, fieldsJson: { uid: "12345" }, status: "PROCESSING" } },
      },
    });
  }

  const oOk = await stuckOrder("RCOK0001", pkgFzr.id, 500, 30);
  const oFail = await stuckOrder("RCFAIL01", pkgFzr.id, 500, 30);
  const oYoung = await stuckOrder("RCYOUNG1", pkgFzr.id, 500, 5);
  const oEris = await stuckOrder("RCERIS01", pkgEris.id, 500, 25 * 60);

  const summary = await recoverStuckOrders();
  console.log("summary:", JSON.stringify(summary));

  const sOk = await prisma.order.findUnique({ where: { id: oOk.id }, select: { status: true } });
  const sFail = await prisma.order.findUnique({ where: { id: oFail.id }, select: { status: true } });
  const sYoung = await prisma.order.findUnique({ where: { id: oYoung.id }, select: { status: true } });
  const sEris = await prisma.order.findUnique({ where: { id: oEris.id }, select: { status: true, note: true } });
  const bal = await balance(userId);

  let allOk = true;
  const c1 = sOk?.status === "DELIVERED";
  console.log(`stuck FZR completed -> ${sOk?.status}`, c1 ? "OK" : "FAIL");
  allOk = allOk && c1;
  const c2 = sFail?.status === "REFUNDED" && bal === 500;
  console.log(`stuck FZR failed -> ${sFail?.status} balance=${bal} (expect REFUNDED/500)`, c2 ? "OK" : "FAIL");
  allOk = allOk && c2;
  const c3 = sYoung?.status === "PROCESSING";
  console.log(`young order untouched -> ${sYoung?.status}`, c3 ? "OK" : "FAIL");
  allOk = allOk && c3;
  const c4 = sEris?.status === "PROCESSING" && (sEris?.note ?? "").includes("[RECOVERY_ESCALATED]");
  console.log(`ERIS 25h -> status=${sEris?.status} escalated=${(sEris?.note ?? "").includes("[RECOVERY_ESCALATED]")}`, c4 ? "OK" : "FAIL");
  allOk = allOk && c4;

  const summary2 = await recoverStuckOrders();
  const sEris2 = await prisma.order.findUnique({ where: { id: oEris.id }, select: { note: true } });
  const marks = (sEris2?.note ?? "").split("[RECOVERY_ESCALATED]").length - 1;
  const c5 = marks === 1;
  console.log(`second run: escalated marks=${marks} (expect 1, no duplicate)`, c5 ? "OK" : "FAIL");
  allOk = allOk && c5;

  console.log(allOk ? "ALL OK" : "SOME FAILED");

  await prisma.notification.deleteMany({ where: { userId: { in: [userId] }, title: { contains: "kẹt" } } }).catch(() => undefined);
  await prisma.orderItem.deleteMany({ where: { orderId: { in: [oOk.id, oFail.id, oYoung.id, oEris.id] } } });
  await prisma.order.deleteMany({ where: { id: { in: [oOk.id, oFail.id, oYoung.id, oEris.id] } } });
  await prisma.package.deleteMany({ where: { id: { in: [pkgFzr.id, pkgEris.id] } } });
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
