import { prisma } from "../src/lib/db";
async function main() {
  const rows: Record<string, string> = { sepay_secret: "local-dummy", sepay_merchant: "LOCAL", sepay_account: "0123456789", sepay_bank_code: "VCB" };
  for (const [key, value] of Object.entries(rows)) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  console.log("gw settings set");
  await prisma.$disconnect();
}
main();
