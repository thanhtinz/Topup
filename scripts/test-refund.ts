import { prisma } from "../src/lib/db";
import { applyBalance } from "../src/lib/wallet";
import { failOrderWithRefund, refundOrder, newOrderCode } from "../src/lib/orders";
import { assertTestDb } from "./guard";

async function main() {
  assertTestDb();
  const user = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!user) throw new Error("no demo user");
  const pkg = await prisma.package.findFirst({ where: { active: true } });
  if (!pkg) throw new Error("no package");
  const start = (await prisma.user.findUnique({ where: { id: user.id }, select: { balanceCents: true } }))!.balanceCents;

  const order = await prisma.$transaction(async (tx) => {
    await applyBalance(tx, user.id, -1000, "purchase", undefined, "test buy");
    const created = await tx.order.create({
      data: {
        code: "TMP", userId: user.id, gameId: pkg.gameId, totalCents: 1000, status: "PROCESSING",
        items: { create: { packageId: pkg.id, qty: 1, priceCents: 1000, fieldsJson: {}, status: "FAILED" } },
      },
    });
    const code = newOrderCode(created.id);
    await tx.order.update({ where: { id: created.id }, data: { code } });
    return { ...created, code };
  });
  const mid = (await prisma.user.findUnique({ where: { id: user.id }, select: { balanceCents: true } }))!.balanceCents;
  console.log("after buy:", mid, "expected:", start - 1000, mid === start - 1000 ? "OK" : "FAIL");

  await failOrderWithRefund(order.id, user.id, order.code);
  const o1 = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } });
  const b1 = (await prisma.user.findUnique({ where: { id: user.id }, select: { balanceCents: true } }))!.balanceCents;
  console.log("after failOrderWithRefund:", o1?.status, "balance:", b1, o1?.status === "REFUNDED" && b1 === start ? "OK" : "FAIL");

  await Promise.allSettled([
    failOrderWithRefund(order.id, user.id, order.code),
    failOrderWithRefund(order.id, user.id, order.code),
    refundOrder(order.id).catch(() => null),
    refundOrder(order.id).catch(() => null),
  ]);
  const b2 = (await prisma.user.findUnique({ where: { id: user.id }, select: { balanceCents: true } }))!.balanceCents;
  const refunds = await prisma.walletTxn.count({ where: { userId: user.id, kind: "refund", ref: order.code } });
  console.log("after duplicate attempts: balance:", b2, "refund txns:", refunds, b2 === start && refunds === 1 ? "OK" : "FAIL");

  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
