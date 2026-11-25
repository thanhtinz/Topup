import "../tests/env";
import { prisma } from "../src/lib/db";

async function main() {
  const demo = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!demo) throw new Error("NO_DEMO");
  await prisma.depositRequest.deleteMany({ where: { code: "NT900003" } });
  await prisma.depositRequest.create({ data: { code: "NT900003", userId: demo.id, amountCents: 2000, method: "SEPAY", vndAmount: 520000 } });
  console.log("đã tạo lệnh mẫu NT900003 (SePay, chờ thanh toán)");
  await prisma.$disconnect();
}
main();
