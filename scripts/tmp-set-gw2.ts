import { prisma } from "../src/lib/db";
async function main() {
  const rows: Record<string, string> = { pay_sepay_enabled: "1", sepay_account_number: "0123456789", sepay_secret: "local-dummy-secret", sepay_bank_name: "Vietcombank", sepay_bank_bin: "970436", sepay_account_name: "BNT GAME" };
  for (const [key, value] of Object.entries(rows)) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  console.log("sepay cfg set");
  await prisma.$disconnect();
}
main();
