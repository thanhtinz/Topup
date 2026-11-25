import { recoverStuckOrders } from "../src/lib/recovery";
import { prisma } from "../src/lib/db";

async function main() {
  const summary = await recoverStuckOrders();
  console.log("recovery summary:", JSON.stringify(summary));
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
