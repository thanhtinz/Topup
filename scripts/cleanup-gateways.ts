import "../tests/env";
import { prisma } from "../src/lib/db";

async function main() {
  await prisma.depositRequest.deleteMany({ where: { code: "NT900003" } });
  await prisma.walletTxn.deleteMany({ where: { ref: { in: ["NT900001", "NT900002", "NT900003"] } } });
  const demo = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (demo) await prisma.user.update({ where: { id: demo.id }, data: { balanceCents: 5000 } });
  const keys = await prisma.setting.findMany({ where: { key: { in: ["pay_sepay_enabled", "pay_bntpay_enabled", "sepay_secret", "sepay_account_number", "bntpay_api_key", "bntpay_webhook_secret"] } } });
  const deps = await prisma.depositRequest.count({ where: { code: { startsWith: "NT900" } } });
  console.log("setting test còn lại:", keys.map((k) => k.key).join(",") || "(không)");
  console.log("lệnh test còn lại:", deps, "| số dư demo:", demo?.balanceCents);
  await prisma.$disconnect();
}
main();
