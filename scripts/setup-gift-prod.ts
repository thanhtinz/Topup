import { ensureGiftCatalog, syncGiftCatalog } from "../src/lib/steamgift";
(async () => {
  const { game, pkg } = await ensureGiftCatalog();
  console.log("HUB", game.id, game.slug, "pkg", pkg.id);
  if (process.argv.includes("--sync")) {
    const t0 = Date.now();
    const r = await syncGiftCatalog();
    console.log("SYNC", JSON.stringify(r), "ms:", Date.now() - t0);
  }
  process.exit(0);
})().catch((e) => { console.error("ERR", e instanceof Error ? e.message : e); process.exit(1); });
