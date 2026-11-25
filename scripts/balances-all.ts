import { prisma } from "../src/lib/db";
async function main() {
  const us = await prisma.user.findMany({ select: { id: true, email: true, role: true, balanceCents: true }, orderBy: { id: "asc" } });
  for (const u of us) console.log(u.id, u.email, u.role, u.balanceCents);
  const txns = await prisma.walletTxn.findMany({ where: { kind: "admin_adjust" }, orderBy: { id: "desc" }, take: 4, select: { userId: true, deltaCents: true, note: true } });
  for (const t of txns) console.log("txn:", t.userId, t.deltaCents, t.note);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
