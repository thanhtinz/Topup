import "../tests/env";
import { prisma } from "../src/lib/db";
import { makeSessionToken } from "../src/lib/crypto";

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!user) throw new Error("NO_DEMO_USER");
  console.log(makeSessionToken(user.id, user.role));
  await prisma.$disconnect();
}
main();
