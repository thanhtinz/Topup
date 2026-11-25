import { prisma } from "../src/lib/db";
import { ensureTelegramCatalog, tgSellCents } from "../src/lib/telegram";
async function main() {
  const { game } = await ensureTelegramCatalog();
  const perStar = 0.0152625;
  const packs = [50,100,200,250,500,750,1000,2500,5000,10000,25000,50000,75000,100000];
  for (const n of packs) {
    const ext = `telegram_stars::${n}`;
    const data = { gameId: game.id, name: `${n.toLocaleString("en-US")} Sao`, costCents: Math.ceil(perStar*n*100), priceCents: tgSellCents(perStar*n, 7), active: true };
    const f = await prisma.package.findFirst({ where: { provider: "FZR", externalId: ext } });
    if (f) await prisma.package.update({ where: { id: f.id }, data }); else await prisma.package.create({ data: { ...data, provider: "FZR", externalId: ext, region: "Global", method: "UID" } });
  }
  for (const [m, usd] of [[3,12.1999],[6,16.2699],[12,29.4974]] as const) {
    const ext = `telegram_premium::${m}`;
    const data = { gameId: game.id, name: `Premium ${m} tháng`, costCents: Math.ceil(usd*100), priceCents: tgSellCents(usd, 7), active: true };
    const f = await prisma.package.findFirst({ where: { provider: "FZR", externalId: ext } });
    if (f) await prisma.package.update({ where: { id: f.id }, data }); else await prisma.package.create({ data: { ...data, provider: "FZR", externalId: ext, region: "Global", method: "UID" } });
  }
  console.log("seeded telegram packs local");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
