import { prisma } from "../src/lib/db";
import { assertTestDb } from "./guard";

async function main() {
  assertTestDb();
  await prisma.partnerApplication.deleteMany({ where: { email: "stafftest@example.com" } });
  const app = await prisma.partnerApplication.create({
    data: { fullName: "Staff Test", email: "stafftest@example.com", typesJson: ["AFFILIATE"], status: "SUBMITTED" },
  });
  console.log("application id", app.id);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
