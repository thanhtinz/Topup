import { prisma } from "../src/lib/db";
import { applyPoints } from "../src/lib/points";
import { assertTestDb } from "./guard";

async function main() {
  assertTestDb();
  const user = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!user) throw new Error("no demo user");
  await prisma.user.update({ where: { id: user.id }, data: { points: 400 } });
  await prisma.pointTxn.deleteMany({ where: { userId: user.id, kind: "SPEND", ref: "RACE" } });

  const attempt = () =>
    prisma.$transaction(async (tx) => {
      await applyPoints(tx, user.id, -300, "SPEND", "RACE", "race test");
    });
  const results = await Promise.allSettled([attempt(), attempt(), attempt(), attempt()]);
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const final = (await prisma.user.findUnique({ where: { id: user.id }, select: { points: true } }))!.points;
  console.log(`succeeded: ${ok}/4, final points: ${final}`, ok === 1 && final === 100 ? "OK" : "FAIL");

  await prisma.pointTxn.deleteMany({ where: { userId: user.id, kind: "SPEND", ref: "RACE" } });
  await prisma.user.update({ where: { id: user.id }, data: { points: 0 } });
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
