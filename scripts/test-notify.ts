import { prisma } from "../src/lib/db";
import { checkGamePriceDrop } from "../src/lib/engage";
async function main() {
  const demo = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  const pkg = await prisma.package.findFirst({ where: { id: 1 }, include: { game: true } });
  const f1 = await checkGamePriceDrop(pkg!.gameId, pkg!.name, 600, 500);
  const f2 = await checkGamePriceDrop(pkg!.gameId, pkg!.name, 500, 400);
  const n = await prisma.notification.findFirst({ where: { userId: demo!.id, title: `Giá ${pkg!.game.name} vừa giảm` }, orderBy: { createdAt: "desc" } });
  console.log("fired1:", f1, "fired2(spam guard):", f2, "title:", n?.title, "| body:", n?.body);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
