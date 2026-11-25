import "../tests/env";
import { prisma } from "../src/lib/db";

async function main() {
  const demo = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!demo) throw new Error("no demo");
  await prisma.user.update({ where: { id: demo.id }, data: { points: 500, pointsTotalEarned: 640 } });
  const existing = await prisma.order.findFirst({ where: { userId: demo.id, code: "NAPSHOT14" } });
  if (!existing) {
    const pkg = await prisma.package.findFirst({ where: { active: true }, orderBy: { priceCents: "asc" }, include: { game: true } });
    await prisma.order.create({
      data: {
        code: "NAPSHOT14",
        userId: demo.id,
        gameId: pkg!.gameId,
        totalCents: pkg!.priceCents,
        status: "DELIVERED",
        items: { create: { packageId: pkg!.id, qty: 1, priceCents: pkg!.priceCents, fieldsJson: { uid: "UID123" }, status: "DELIVERED" } },
      },
    });
  }
  console.log("setup ok");
  await prisma.$disconnect();
}
main();
