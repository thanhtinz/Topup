import "../tests/env";
import { prisma } from "../src/lib/db";
import { makeSessionToken } from "../src/lib/crypto";

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("NO_ADMIN");
  console.log(makeSessionToken(admin.id, admin.role));
  await prisma.$disconnect();
}
main();
