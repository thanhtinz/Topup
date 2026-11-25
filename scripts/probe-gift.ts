import { prisma } from "../src/lib/db";
import { decryptSecret } from "../src/lib/crypto";

async function main() {
  const p = await prisma.provider.findUnique({ where: { code: "FZR" } });
  if (!p) throw new Error("no FZR provider");
  const key = decryptSecret(p.apiKeyEnc);
  const base = p.baseUrl || "https://api.fzr.cards";
  const headers = { "X-API-Key": key };
  for (const appid of ["730", "346110"]) {
    const res = await fetch(`${base}/api/v2/steam-gifts/games/${appid}`, { headers });
    const j: any = await res.json().catch(() => null);
    const offers = Array.isArray(j?.offers) ? j.offers : [];
    console.log(`== appid ${appid}: HTTP ${res.status}, offers=${offers.length}`);
    for (const o of offers.slice(0, 3)) {
      console.log(`   sub_id=${o.sub_id} name=${JSON.stringify(o.name)} regions=${(o.regions || []).length}`);
      console.log(`   regions sample: ${JSON.stringify((o.regions || []).slice(0, 5))}`);
    }
  }
  const res = await fetch(`${base}/api/v2/steam-gifts/games?limit=20`, { headers });
  const j: any = await res.json().catch(() => null);
  console.log(`== list: HTTP ${res.status}, keys=${j ? Object.keys(j) : "?"}, meta=${JSON.stringify(j?.meta ?? j?.pagination ?? null)}`);
  const items = j?.games ?? j?.data ?? j?.items ?? [];
  console.log(`   items=${Array.isArray(items) ? items.length : "?"} sample=${JSON.stringify(Array.isArray(items) ? items.slice(0, 3) : items)}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
