import { runCreatorMigration } from "../src/lib/creator";
import { prisma } from "../src/lib/db";

(async () => {
  const before = {
    users: await prisma.user.count(),
    creators: await prisma.creator.count(),
    affBalTotal: (await prisma.user.aggregate({ _sum: { affiliateBalanceCents: true } }))._sum.affiliateBalanceCents ?? 0,
    referrers: await prisma.user.count({ where: { referrals: { some: {} } } }),
  };
  const res = await runCreatorMigration();
  const after = {
    creators: await prisma.creator.count(),
    migrateTxns: await prisma.affiliateTxn.count({ where: { kind: "MIGRATE" } }),
    adjustments: await prisma.creatorAdjustment.count(),
  };
  console.log(JSON.stringify({ before, res, after }));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
