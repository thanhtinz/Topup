import { prisma } from "../src/lib/db";
async function main() {
  const r = await prisma.package.updateMany({ where: { provider: "FZR", externalId: "telegram_stars::stars" }, data: { active: false } });
  console.log("deactivated unit packs:", r.count);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
