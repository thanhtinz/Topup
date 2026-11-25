import { prisma } from "../src/lib/db";
import { awardReviewPoints, checkLateCompensation, type PointsConfig, type VipTierRow } from "../src/lib/points";
import { assertTestDb } from "./guard";

async function main() {
  assertTestDb();
  const user = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!user) throw new Error("no demo user");
  const userId = user.id;
  let allOk = true;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  await prisma.pointTxn.deleteMany({ where: { userId, kind: "EARN_REVIEW", createdAt: { gte: startOfToday } } });
  await prisma.user.update({ where: { id: userId }, data: { points: 0 } });

  const cfg: PointsConfig = { enabled: true, perReview: 2, dailyCap: 4, maxPayPercent: 5, vipLateHours: 24, vipLatePoints: 50 };
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      prisma.$transaction(async (tx) => awardReviewPoints(tx, userId, `CAPTEST-${i}`, cfg)),
    ),
  );
  const awardedCount = results.filter((r) => r > 0).length;
  const txnCount = await prisma.pointTxn.count({ where: { userId, kind: "EARN_REVIEW", createdAt: { gte: startOfToday } } });
  const pts = (await prisma.user.findUnique({ where: { id: userId }, select: { points: true } }))!.points;
  const ok1 = awardedCount === 4 && txnCount === 4 && pts === 8;
  console.log(`review cap race: awarded=${awardedCount}/8 txns=${txnCount} points=${pts} (expect 4/4/8)`, ok1 ? "OK" : "FAIL");
  allOk = allOk && ok1;

  const createdAt = new Date(Date.now() - 72 * 3600_000);
  const updatedAt = new Date(Date.now() - 40 * 3600_000);
  const game = await prisma.game.findFirst({ where: { active: true }, orderBy: { id: "asc" } });
  if (!game) throw new Error("no game");
  const order = await prisma.order.create({
    data: { code: "LATECOMP1", userId, gameId: game.id, totalCents: 1000, status: "DELIVERED", createdAt, updatedAt },
  });
  await prisma.pointTxn.deleteMany({ where: { userId, kind: "LATE_COMP", ref: "LATECOMP1" } });
  const tier: VipTierRow = { id: 999, name: "TEST", thresholdCents: 0, discountPercent: 0, couponPercent: 0, lateComp: true, iconUrl: null, sort: 0 };
  const before = (await prisma.user.findUnique({ where: { id: userId }, select: { points: true } }))!.points;
  await Promise.all([
    checkLateCompensation(userId, tier, cfg),
    checkLateCompensation(userId, tier, cfg),
    checkLateCompensation(userId, tier, cfg),
    checkLateCompensation(userId, tier, cfg),
  ]);
  const compTxns = await prisma.pointTxn.count({ where: { userId, kind: "LATE_COMP", ref: "LATECOMP1" } });
  const after = (await prisma.user.findUnique({ where: { id: userId }, select: { points: true } }))!.points;
  const ok2 = compTxns === 1 && after - before === 50;
  console.log(`late comp race: txns=${compTxns} pointsDelta=${after - before} (expect 1/50)`, ok2 ? "OK" : "FAIL");
  allOk = allOk && ok2;

  console.log(allOk ? "ALL OK" : "SOME FAILED");

  await prisma.pointTxn.deleteMany({ where: { userId, kind: "LATE_COMP", ref: "LATECOMP1" } });
  await prisma.pointTxn.deleteMany({ where: { userId, kind: "EARN_REVIEW", createdAt: { gte: startOfToday } } });
  await prisma.order.delete({ where: { id: order.id } });
  await prisma.user.update({ where: { id: userId }, data: { points: 0 } });
  await prisma.$disconnect();
  process.exit(allOk ? 0 : 1);
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
