import { ensureSteamCatalog, steamConfig } from "../src/lib/steam";
(async () => {
  const { game, pkg } = await ensureSteamCatalog();
  const cfg = await steamConfig();
  console.log("game:", game.id, game.slug, game.name, "cover:", game.cover);
  console.log("pkg:", pkg.id, pkg.name, "price:", pkg.priceCents, "cost:", pkg.costCents, "provider:", pkg.provider);
  console.log("cfg:", JSON.stringify(cfg));
  process.exit(0);
})();
