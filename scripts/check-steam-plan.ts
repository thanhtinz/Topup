import { setSetting } from "../src/lib/settings";
import { steamConfig, ensureSteamCatalog } from "../src/lib/steam";
async function main() {
  await setSetting("steam_discount_percent", "3.55");
  await setSetting("steam_markup_percent", "2");
  const cfg = await steamConfig();
  console.log("Gold 3.55% + markup 2% -> unitCost:", cfg.unitCostCents, "(expect 97) unitPrice:", cfg.unitPriceCents, "(expect 99)");
  const { pkg } = await ensureSteamCatalog();
  console.log("pkg synced -> price:", pkg.priceCents, "cost:", pkg.costCents);
  await setSetting("steam_discount_percent", "0");
  const cfg0 = await steamConfig();
  console.log("discount 0 -> unitCost:", cfg0.unitCostCents, "(expect 100) unitPrice:", cfg0.unitPriceCents, "(expect 102)");
  await ensureSteamCatalog();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
