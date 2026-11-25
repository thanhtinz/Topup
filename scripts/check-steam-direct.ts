import { setSetting } from "../src/lib/settings";
import { steamConfig, ensureSteamCatalog } from "../src/lib/steam";
async function main() {
  await setSetting("steam_unit_price_cents", "");
  let cfg = await steamConfig();
  console.log("no direct price -> unitPrice:", cfg.unitPriceCents, "(expect 102 fallback)");
  await setSetting("steam_unit_price_cents", "99");
  cfg = await steamConfig();
  const { pkg } = await ensureSteamCatalog();
  console.log("direct 99 -> unitPrice:", cfg.unitPriceCents, "pkg price:", pkg.priceCents, "pkg cost:", pkg.costCents, "(expect 99/99/100)");
  await setSetting("steam_unit_price_cents", "");
  await ensureSteamCatalog();
  cfg = await steamConfig();
  console.log("cleared -> unitPrice:", cfg.unitPriceCents, "(expect 102)");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
