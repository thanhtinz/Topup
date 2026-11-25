import { prisma } from "../src/lib/db";
import { translateErisName } from "../src/lib/eris-names";

async function main() {
  const apply = process.argv.includes("--apply");
  const pkgs = await prisma.package.findMany({ where: { provider: "ERIS" }, select: { id: true, name: true } });
  let changed = 0;
  for (const p of pkgs) {
    const next = translateErisName(p.name);
    if (next !== p.name) {
      changed++;
      console.log(`${p.name}  ->  ${next}`);
      if (apply) await prisma.package.update({ where: { id: p.id }, data: { name: next } });
    }
  }
  console.log(`total=${pkgs.length} changed=${changed} applied=${apply}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
