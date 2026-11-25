import { prisma } from "../src/lib/db";
import { makeSessionToken } from "../src/lib/crypto";
import { writeFileSync } from "node:fs";
async function main() {
  const staff = await prisma.user.upsert({
    where: { email: "staff@bnttopup.local" },
    create: { email: "staff@bnttopup.local", name: "Nhân viên test", passwordHash: "x", role: "STAFF", balanceCents: 0 },
    update: { role: "STAFF", active: true },
  });
  const admin = await prisma.user.findUnique({ where: { email: "admin@bnttopup.local" } });
  if (!admin) throw new Error("no admin");
  writeFileSync("/tmp/tok-staff.txt", makeSessionToken(staff.id, "STAFF"));
  writeFileSync("/tmp/tok-admin.txt", makeSessionToken(admin.id, "ADMIN"));
  console.log("staff id", staff.id, "admin id", admin.id);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
