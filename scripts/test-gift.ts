import { prisma } from "../src/lib/db";
import { buySteamGift, ensureGiftCatalog, giftConfig, giftSellCents, giftCostCents, syncGiftCatalog } from "../src/lib/steamgift";

(async () => {
  let pass = 0, fail = 0;
  const ok = (cond: boolean, label: string, extra = "") => { console.log((cond ? "PASS" : "FAIL"), label, extra); cond ? pass++ : fail++; };

  ok(giftSellCents(14.1906, 2) === 1448, "sell 14.1906 @2% = 1448", String(giftSellCents(14.1906, 2)));
  ok(giftCostCents(14.1906, 3.55) === 1369, "cost 14.1906 @3.55% = 1369", String(giftCostCents(14.1906, 3.55)));
  ok(giftSellCents(7.1798, 2) === 733, "sell 7.1798 @2% = 733", String(giftSellCents(7.1798, 2)));

  const cfg = await giftConfig();
  ok(cfg.enabled === true && cfg.markupPct === 2, "config default enabled, markup 2", JSON.stringify(cfg));
  const { game, pkg } = await ensureGiftCatalog();
  ok(game.slug === "steam-gift" && pkg.externalId === "steam_gift::hub", "hub catalog created", `game=${game.id} pkg=${pkg.id}`);

  await prisma.steamGiftGame.upsert({ where: { appid: 730 }, create: { appid: 730, name: "Counter-Strike 2", rank: 0 }, update: { name: "Counter-Strike 2", rank: 0, active: true } });
  await prisma.steamGiftGame.upsert({ where: { appid: 346110 }, create: { appid: 346110, name: "ARK: Survival Evolved", rank: 2 }, update: { active: true } });

  const demo = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!demo) throw new Error("no demo user");
  await prisma.user.update({ where: { id: demo.id }, data: { balanceCents: 100000 } });

  try { await buySteamGift({ userId: demo.id, appid: 730, subId: "54029", region: "UA", inviteUrl: "short" }); ok(false, "invite short blocked"); }
  catch (e) { ok((e as Error).message === "GIFT_INVITE_REQUIRED", "invite short -> GIFT_INVITE_REQUIRED", (e as Error).message); }

  try { await buySteamGift({ userId: demo.id, appid: 730, subId: "", region: "", inviteUrl: "https://s.team/p/p/xxxx" }); ok(false, "offer invalid blocked"); }
  catch (e) { ok((e as Error).message === "GIFT_OFFER_INVALID", "empty sub/region -> GIFT_OFFER_INVALID", (e as Error).message); }

  try { await buySteamGift({ userId: demo.id, appid: 999999, subId: "1", region: "US", inviteUrl: "https://s.team/p/p/xxxx" }); ok(false, "unknown game blocked"); }
  catch (e) { ok((e as Error).message === "GIFT_GAME_UNAVAILABLE", "unknown appid -> GIFT_GAME_UNAVAILABLE", (e as Error).message); }

  try { await buySteamGift({ userId: demo.id, appid: 730, subId: "54029", region: "UA", inviteUrl: "https://s.team/p/p/xxxx" }); ok(false, "no-provider blocked"); }
  catch (e) { ok((e as Error).message === "GIFT_UNAVAILABLE", "no FZR -> GIFT_UNAVAILABLE", (e as Error).message); }
  const after = await prisma.user.findUnique({ where: { id: demo.id }, select: { balanceCents: true } });
  ok(after?.balanceCents === 100000, "balance untouched after all failures", String(after?.balanceCents));
  const orders = await prisma.order.count({ where: { userId: demo.id, gameId: game.id } });
  ok(orders === 0, "no gift orders created", String(orders));

  try { await syncGiftCatalog(); ok(false, "sync blocked without provider"); }
  catch (e) { ok((e as Error).message === "PROVIDER_NOT_CONFIGURED", "sync no FZR -> PROVIDER_NOT_CONFIGURED", (e as Error).message); }

  console.log(`== ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
