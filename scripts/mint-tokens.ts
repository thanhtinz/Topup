import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/db";
import { makeSessionToken } from "../src/lib/crypto";
async function main() {
  const admin = await prisma.user.findUnique({ where: { email: "admin@bnttopup.local" } });
  const demo = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!admin || !demo) throw new Error("thiếu user seed");
  writeFileSync("/tmp/tok-admin.txt", makeSessionToken(admin.id, "ADMIN"));
  writeFileSync("/tmp/tok-demo.txt", makeSessionToken(demo.id, "USER"));
  console.log("minted", admin.id, demo.id);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
