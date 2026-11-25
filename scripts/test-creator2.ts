import { prisma } from "../src/lib/db";
import {
  ensureCreatorLevels, setAttribution, awardCreatorCommissionForOrder,
  creatorBalances, requestPayout, runCreatorMigration, ensureLegacyCreator,
} from "../src/lib/creator";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${extra}`); }
}

async function main() {
  await ensureCreatorLevels();
  const levels = await prisma.creatorLevel.findMany({ orderBy: { sort: "asc" } });
  const gold = levels.find((l) => l.name === "Gold")!;
  const diamond = levels.find((l) => l.name === "Diamond")!;
  const stamp = Date.now();
  const buyer = await prisma.user.create({ data: { name: "B2", email: `b2-${stamp}@t.local`, passwordHash: "x" } });
  const anyGame = await prisma.game.findFirst({ where: { slug: { notIn: ["steam-top-up", "telegram", "steam-gift"] } }, select: { id: true } });
  await prisma.game.upsert({ where: { slug: "telegram" }, create: { slug: "telegram", name: "Telegram", active: true, cover: "" }, update: {} });
  let fzrPkg = await prisma.package.findFirst({ where: { provider: "FZR", active: true }, select: { id: true, gameId: true } });
  if (!fzrPkg && anyGame) {
    fzrPkg = await prisma.package.create({ data: { gameId: anyGame.id, name: "FZR Fixture", provider: "FZR", externalId: `fixture-${stamp}`, priceCents: 10000, costCents: 9800, active: true }, select: { id: true, gameId: true } });
  }

  async function mkCreator(levelId: number, tag: string) {
    const u = await prisma.user.create({ data: { name: tag, email: `${tag}-${stamp}@t.local`, passwordHash: "x" } });
    const c = await prisma.creator.create({
      data: { userId: u.id, code: `${tag}${stamp}`.toUpperCase(), displayName: tag, levelId, agreementAt: new Date(), agreementVersion: "1.0" },
      include: { level: true },
    });
    await setAttribution(buyer.id, c.id, null, "LINK");
    return { u, c };
  }
  async function mkOrder(gameId: number, total: number, pkgId?: number) {
    const o = await prisma.order.create({
      data: {
        code: `T2-${stamp}-${Math.floor(Math.random() * 1e9)}`, userId: buyer.id, gameId, status: "DELIVERED", totalCents: total,
        ...(pkgId ? { items: { create: { packageId: pkgId, qty: 1, priceCents: total, status: "DELIVERED" } } } : {}),
      },
    });
    return o;
  }

  const { c: dia } = await mkCreator(diamond.id, "Dia");
  const camp = await prisma.creatorCampaign.create({
    data: { name: `Cap ${stamp}`, slug: `cap-${stamp}`, startAt: new Date(Date.now() - 86400000), endAt: new Date(Date.now() + 86400000), bonusBps: 500, status: "ACTIVE" },
  });
  await prisma.creatorCampaignJoin.create({ data: { campaignId: camp.id, creatorId: dia.id, status: "APPROVED" } });
  const o1 = await mkOrder(anyGame!.id, 10000);
  await awardCreatorCommissionForOrder(o1.id);
  const cm1 = await prisma.creatorCommission.findUnique({ where: { orderId: o1.id } });
  check("bonus stacks but capped at 10%", !!cm1 && cm1.rateBps === 1000 && cm1.amountCents === 1000, JSON.stringify(cm1));

  check("has FZR package for test", !!fzrPkg);
  if (fzrPkg) {
    const o2 = await mkOrder(fzrPkg.gameId, 10000, fzrPkg.id);
    await awardCreatorCommissionForOrder(o2.id);
    const cm2 = await prisma.creatorCommission.findUnique({ where: { orderId: o2.id } });
    check("FZR group carve-out 1% (no bonus, no level)", !!cm2 && cm2.rateBps === 100 && cm2.amountCents === 100 && cm2.campaignId === null, JSON.stringify(cm2));
  }

  const tgGame = await prisma.game.findUnique({ where: { slug: "telegram" }, select: { id: true } });
  check("has telegram game for test", !!tgGame);
  if (tgGame) {
    const o3 = await mkOrder(tgGame.id, 10000);
    await awardCreatorCommissionForOrder(o3.id);
    const cm3 = await prisma.creatorCommission.findUnique({ where: { orderId: o3.id } });
    check("Telegram carve-out 1%", !!cm3 && cm3.rateBps === 100 && cm3.amountCents === 100, JSON.stringify(cm3));
  }

  const { c: goldC } = await mkCreator(gold.id, "Gold2");
  await prisma.creatorCampaignJoin.create({ data: { campaignId: camp.id, creatorId: goldC.id, status: "APPROVED" } });
  const o4 = await mkOrder(anyGame!.id, 10000);
  await awardCreatorCommissionForOrder(o4.id);
  const cm4 = await prisma.creatorCommission.findUnique({ where: { orderId: o4.id } });
  check("standard group: level + bonus applied", !!cm4 && cm4.creatorId === goldC.id && cm4.rateBps === 1000, JSON.stringify(cm4));

  await prisma.setting.deleteMany({ where: { key: "creator_migration_v1" } });
  const legacy = await prisma.user.create({ data: { name: "Legacy Ref", email: `legacy-${stamp}@t.local`, passwordHash: "x", affiliateBalanceCents: 1500, affiliateEarnedCents: 1500 } });
  await prisma.user.create({ data: { name: "Referred", email: `referred-${stamp}@t.local`, passwordHash: "x", referredById: legacy.id } });
  const mig = await runCreatorMigration();
  const legacyCreator = await prisma.creator.findUnique({ where: { userId: legacy.id }, include: { level: true } });
  check("migration creates Starter creator", !!legacyCreator && legacyCreator.level?.name === "Starter", JSON.stringify(mig));
  check("migration leaves terms unaccepted", legacyCreator?.agreementAt === null);
  const khLink = await prisma.creatorLink.findUnique({ where: { code: `KH${legacy.id}` } });
  check("KH legacy link exists", !!khLink && khLink?.creatorId === legacyCreator?.id);
  const legacyAfter = await prisma.user.findUnique({ where: { id: legacy.id } });
  const migTxn = await prisma.affiliateTxn.findFirst({ where: { userId: legacy.id, kind: "MIGRATE" } });
  const balLegacy = legacyCreator ? await creatorBalances(legacyCreator.id) : null;
  check("balance moved intact to creator wallet", legacyAfter?.affiliateBalanceCents === 0 && balLegacy?.availableCents === 1500, JSON.stringify({ balLegacy, migTxn: !!migTxn }));
  check("migration ledger rows exist", !!migTxn && migTxn.amountCents === 1500);
  const mig2 = await runCreatorMigration();
  const balLegacy2 = legacyCreator ? await creatorBalances(legacyCreator.id) : null;
  check("migration idempotent (flag)", mig2.migrated === 0 && balLegacy2?.availableCents === 1500);

  await prisma.setting.upsert({ where: { key: "creator_min_withdraw_cents" }, create: { key: "creator_min_withdraw_cents", value: "100" }, update: { value: "100" } });
  let err = "";
  try { await requestPayout(legacy.id, 1000, "USDT", "TXyz123456"); } catch (e) { err = (e as Error).message; }
  check("payout blocked before terms acceptance", err === "CREATOR_TERMS_REQUIRED", err);
  await prisma.creator.update({ where: { id: legacyCreator!.id }, data: { agreementAt: new Date(), agreementVersion: "1.0" } });
  let ppErr = "";
  try { await requestPayout(legacy.id, 1000, "PAYPAL", "legacy@pay.pal"); } catch (e) { ppErr = (e as Error).message; }
  check("PayPal payout rejected (USDT/BANK only)", ppErr === "PAYOUT_INVALID", ppErr);
  const payout = await requestPayout(legacy.id, 1000, "USDT", "TXyz123456");
  check("payout works after terms acceptance", payout.status === "PENDING" && payout.amountCents === 1000);
  const ensured = await ensureLegacyCreator(legacy.id);
  check("ensureLegacyCreator idempotent", ensured?.id === legacyCreator?.id);

  console.log(`\nRESULT: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
