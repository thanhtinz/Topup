import { prisma } from "../src/lib/db";
async function main() {
  const u = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" }, select: { balanceCents: true } });
  console.log("demo balance:", u?.balanceCents);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
