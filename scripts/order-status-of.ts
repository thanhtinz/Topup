import { prisma } from "../src/lib/db";

async function main() {
  const id = Number(process.argv[2]);
  const o = await prisma.order.findUnique({ where: { id }, select: { status: true, code: true } });
  console.log(`order ${id} (${o?.code}): ${o?.status}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
