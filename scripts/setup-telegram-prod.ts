import { ensureTelegramCatalog, syncTelegramCatalog, telegramPackages, telegramConfig } from "../src/lib/telegram";
import { fzrTelegramStarsQuote, fzrTelegramPremiumPlans } from "../src/lib/providers";

async function main() {
  const cfg = await telegramConfig();
  console.log("CONFIG:", JSON.stringify(cfg));
  const q = await fzrTelegramStarsQuote();
  console.log("QUOTE:", JSON.stringify(q));
  const plans = await fzrTelegramPremiumPlans();
  console.log("PLANS:", JSON.stringify(plans));
  const { game } = await ensureTelegramCatalog();
  console.log("HUB GAME:", game.id, game.slug);
  const r = await syncTelegramCatalog();
  console.log("SYNC:", JSON.stringify(r));
  const packs = await telegramPackages();
  console.log("STARS PACKS:", packs.stars.map((p) => `${p.itemKey}:${p.priceCents}`).join(" "));
  console.log("PREMIUM PACKS:", packs.premium.map((p) => `${p.itemKey}:${p.priceCents}`).join(" "));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
