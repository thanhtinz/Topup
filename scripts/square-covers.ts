import { prisma } from "../src/lib/db";
import { squareRemoteCover } from "../src/lib/squarecover";

async function main() {
  const apply = process.argv.includes("--apply");
  const games = await prisma.game.findMany({
    where: { active: true, cover: { startsWith: "http" } },
    select: { id: true, name: true, cover: true },
    orderBy: { soldCount: "desc" },
  });
  let squared = 0, skipped = 0;
  for (const g of games) {
    if (g.cover.includes("seagmcdn.com")) { skipped++; continue; }
    if (!apply) {
      const { cornersEmpty } = await import("../src/lib/squarecover");
      const r = await fetch(g.cover);
      const buf = Buffer.from(await r.arrayBuffer());
      const empty = r.ok ? await cornersEmpty(buf) : false;
      console.log(`${empty ? "SQUARE-ME" : "ok       "} ${g.name}`);
      if (empty) squared++;
      continue;
    }
    const local = await squareRemoteCover(g.id, g.cover);
    if (local) {
      await prisma.game.update({ where: { id: g.id }, data: { cover: local } });
      squared++;
      console.log(`squared: ${g.name} -> ${local}`);
    } else skipped++;
  }
  console.log(`total=${games.length} squared=${squared} skipped=${skipped} applied=${apply}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
