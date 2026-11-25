import { prisma } from "../src/lib/db";
import { buySteamTopup } from "../src/lib/steam";
(async () => {
  const demo = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!demo) throw new Error("no demo user");
  await prisma.user.update({ where: { id: demo.id }, data: { balanceCents: 100000 } });
  const o = await buySteamTopup({ userId: demo.id, login: "testlogin123", amountCents: 500 });
  const after = await prisma.user.findUnique({ where: { id: demo.id }, select: { balanceCents: true } });
  const item = await prisma.orderItem.findFirst({ where: { orderId: o.id } });
  console.log("ORDER", o.code, "total:", o.totalCents, "status:", o.status, "note:", o.note);
  console.log("BALANCE 100000 ->", after?.balanceCents, "(expect 99490)");
  console.log("ITEM price:", item?.priceCents, "fields:", JSON.stringify(item?.fieldsJson), "status:", item?.status);
  try { await buySteamTopup({ userId: demo.id, login: "x", amountCents: 5 }); console.log("FAIL: min not enforced"); }
  catch (e) { console.log("MIN CHECK:", (e as Error).message); }
  try { await buySteamTopup({ userId: demo.id, login: "  ", amountCents: 500 }); console.log("FAIL: login not enforced"); }
  catch (e) { console.log("LOGIN CHECK:", (e as Error).message); }
  await prisma.user.update({ where: { id: demo.id }, data: { balanceCents: 100 } });
  try { await buySteamTopup({ userId: demo.id, login: "abc", amountCents: 500 }); console.log("FAIL: balance not enforced"); }
  catch (e) { console.log("BALANCE CHECK:", (e as Error).message); }
  process.exit(0);
})();
