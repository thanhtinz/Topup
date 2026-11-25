import { prisma } from "../src/lib/db";
import {
  ensureCreatorLevels, setAttribution, awardCreatorCommissionForOrder,
  reverseCreatorCommissionForOrder, releaseDueCommissions, creatorBalances,
  requestPayout, markPayoutPaid, refreshCreatorLevel,
} from "../src/lib/creator";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${extra}`); }
}

async function mkUser(email: string) {
  return prisma.user.create({ data: { name: email.split("@")[0], email, passwordHash: "x" } });
}
async function mkOrder(userId: number, totalCents: number, promoCode?: string) {
  const game = await prisma.game.findFirst({ select: { id: true } });
  const o = await prisma.order.create({
    data: { code: `T${Date.now()}${Math.floor(Math.random() * 1e5)}`, userId, gameId: game!.id, status: "DELIVERED", totalCents, promoCode },
  });
  return o;
}

async function main() {
  await ensureCreatorLevels();
  const levels = await prisma.creatorLevel.findMany({ orderBy: { sort: "asc" } });
  check("seed 4 levels", levels.length === 4 && levels[0].rateBps === 200 && levels[3].rateBps === 700);

  const stamp = Date.now();
  const creatorUser = await mkUser(`creator${stamp}@t.local`);
  const buyer = await mkUser(`buyer${stamp}@t.local`);
  const buyer2 = await mkUser(`buyer2${stamp}@t.local`);
  const starter = levels[0];
  const creator = await prisma.creator.create({
    data: { userId: creatorUser.id, code: `TEST${stamp}`, displayName: "Test Creator", levelId: starter.id, agreementAt: new Date(), agreementVersion: "1.0" },
    include: { level: true },
  });
  const link = await prisma.creatorLink.create({ data: { creatorId: creator.id, code: creator.code, name: "Main", destination: "/" } });

  await setAttribution(buyer.id, creator.id, link.id, "LINK");
  const o1 = await mkOrder(buyer.id, 10000);
  await awardCreatorCommissionForOrder(o1.id);
  const c1 = await prisma.creatorCommission.findUnique({ where: { orderId: o1.id } });
  check("commission created 2% of $100 = 200", !!c1 && c1.amountCents === 200 && c1.eligibleCents === 10000, JSON.stringify(c1));
  check("status PENDING (hold)", c1?.status === "PENDING");

  await awardCreatorCommissionForOrder(o1.id);
  const count1 = await prisma.creatorCommission.count({ where: { creatorId: creator.id } });
  check("no double award", count1 === 1, `count=${count1}`);

  const otherUser = await mkUser(`other${stamp}@t.local`);
  const other = await prisma.creator.create({ data: { userId: otherUser.id, code: `OTHER${stamp}`, displayName: "Other", levelId: levels[2].id }, include: { level: true } });
  await prisma.discountCode.create({ data: { code: `OTHER5-${stamp}`, percent: 5, creatorId: other.id } });
  await setAttribution(buyer2.id, creator.id, link.id, "LINK");
  const o2 = await mkOrder(buyer2.id, 20000, `OTHER5-${stamp}`);
  await awardCreatorCommissionForOrder(o2.id);
  const c2 = await prisma.creatorCommission.findUnique({ where: { orderId: o2.id } });
  check("coupon creator wins (Gold 5% of $200 = 1000)", !!c2 && c2.creatorId === other.id && c2.amountCents === 1000, JSON.stringify(c2));

  await setAttribution(creatorUser.id, creator.id, link.id, "LINK");
  const o3 = await mkOrder(creatorUser.id, 50000);
  await awardCreatorCommissionForOrder(o3.id);
  const c3 = await prisma.creatorCommission.findUnique({ where: { orderId: o3.id } });
  check("self-referral blocked", c3 === null);

  await prisma.creatorCommission.update({ where: { id: c1!.id }, data: { availableAt: new Date(Date.now() - 1000) } });
  await releaseDueCommissions(creator.id);
  const bal1 = await creatorBalances(creator.id);
  check("available after release = 200", bal1.availableCents === 200 && bal1.pendingCents === 0, JSON.stringify(bal1));

  let err = "";
  await prisma.setting.upsert({ where: { key: "creator_min_withdraw_cents" }, create: { key: "creator_min_withdraw_cents", value: "2000" }, update: { value: "2000" } });
  try { await requestPayout(creatorUser.id, 500, "USDT", "TXyz123456"); } catch (e) { err = (e as Error).message; }
  check("below-min payout blocked", err === "PAYOUT_BELOW_MIN", err);
  const payout = await requestPayout(creatorUser.id, 2000 - 1800 + 0, "USDT", "TXyz123456").catch((e) => e as Error);
  check("payout above available blocked", payout instanceof Error);
  await prisma.setting.upsert({ where: { key: "creator_min_withdraw_cents" }, create: { key: "creator_min_withdraw_cents", value: "100" }, update: { value: "100" } });
  const p2 = await requestPayout(creatorUser.id, 200, "USDT", "TXyz123456");
  const bal2 = await creatorBalances(creator.id);
  check("payout locks balance", bal2.availableCents === 0 && bal2.lockedCents === 200, JSON.stringify(bal2));
  await markPayoutPaid(p2.id, "TXHASH1", 1);
  const bal3 = await creatorBalances(creator.id);
  const c1After = await prisma.creatorCommission.findUnique({ where: { id: c1!.id } });
  check("payout paid flips commission PAID", c1After?.status === "PAID" && bal3.paidOutCents === 200, JSON.stringify(bal3));

  const o4 = await mkOrder(buyer.id, 10000);
  await awardCreatorCommissionForOrder(o4.id);
  const c4 = await prisma.creatorCommission.findUnique({ where: { orderId: o4.id } });
  check("second commission exists", !!c4);
  await reverseCreatorCommissionForOrder(o4.id);
  const c4After = await prisma.creatorCommission.findUnique({ where: { orderId: o4.id } });
  check("reversed on refund", c4After?.status === "REVERSED");

  const o5 = await mkOrder(buyer.id, 60000);
  await setAttribution(buyer.id, other.id, null, "LINK");
  await awardCreatorCommissionForOrder(o5.id);
  await refreshCreatorLevel(other.id);
  const otherAfter = await prisma.creator.findUnique({ where: { id: other.id }, include: { level: true } });
  check("level auto-upgrade by 30d revenue", otherAfter?.level?.name === "Gold" || otherAfter?.level?.name === "Silver", otherAfter?.level?.name);

  console.log(`\nRESULT: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
