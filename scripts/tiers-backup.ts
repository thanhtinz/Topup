import { prisma } from "../src/lib/db";
async function main() {
  const mode = process.argv[2];
  if (mode === "clear") {
    const tiers = await prisma.vipTier.findMany();
    console.log(JSON.stringify(tiers));
    await prisma.vipTier.deleteMany();
  } else if (mode === "restore") {
    const tiers = JSON.parse(process.argv[3] ?? "[]") as Record<string, unknown>[];
    for (const t of tiers) { const { id, ...data } = t as { id: number }; await prisma.vipTier.create({ data: data as never }); }
    console.log("restored", tiers.length);
  }
  await prisma.$disconnect();
}
main();
