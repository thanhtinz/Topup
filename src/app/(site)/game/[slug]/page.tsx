import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { pointsConfig, userTier } from "@/lib/points";
import { getPrefs } from "@/lib/prefs";
import { dict } from "@/lib/i18n";
import { parseUidGuide } from "@/lib/guide";
import { gameVisible, visiblePackages } from "@/lib/visibility";
import BuyPanel from "./BuyPanel";
import WishlistBtn from "@/components/WishlistBtn";
import GameNotifyBtn from "@/components/GameNotifyBtn";
import { liveFlashMap } from "@/lib/flashsale";
import UidGuide from "./UidGuide";
import DescCard from "./DescCard";
import Reviews from "./Reviews";
import SteamTopup from "./SteamTopup";
import SteamGift from "./SteamGift";
import { steamConfig, STEAM_SLUG } from "@/lib/steam";
import { giftConfig, giftGameImage, GIFT_SLUG } from "@/lib/steamgift";
import Telegram from "./Telegram";
import { telegramConfig, telegramPackages, ensureTelegramCatalog, TG_SLUG } from "@/lib/telegram";
import { getSettings } from "@/lib/settings";
import type { Metadata } from "next";
import { getGameSeo, gameTitle, gameDescription, gameJsonLd, SITE_BASE } from "@/lib/seo";


const IcoBag = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
);
const IcoBolt = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M13 2 4.8 13.2h6L9.6 22 19 10.4h-6.2L13 2Z" /></svg>
);
const IcoClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const seo = await getGameSeo(slug).catch(() => null);
  if (!seo) return {};
  const prefs = await getPrefs().catch(() => null);
  const en = prefs?.lang === "en";
  const title = gameTitle(seo, en);
  const description = gameDescription(seo, en);
  const url = `${SITE_BASE}/game/${seo.slug}`;
  return {
    title,
    description,
    keywords: en
      ? [`top up ${seo.name}`, `${seo.name} top up cheap`, `buy ${seo.name}`, seo.name]
      : [`nạp ${seo.name}`, `nạp ${seo.name} giá rẻ`, `mua ${seo.name}`, `top up ${seo.name}`, seo.name],
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "BNTGame",
      type: "website",
      images: seo.image ? [{ url: seo.image, alt: seo.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: seo.image ? [seo.image] : undefined,
    },
  };
}


async function GamePageInner({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ err?: string; msg?: string; pkg?: string; quick?: string }> }) {
  const { slug } = await params;
  const { err, msg, pkg: pkgParam, quick } = await searchParams;
  if (slug === TG_SLUG) await ensureTelegramCatalog();
  const game = await prisma.game.findUnique({
    where: { slug },
    include: { packages: { where: { active: true }, orderBy: { priceCents: "asc" } } },
  });
  if (!game || !gameVisible(game, game.packages.map((p) => p.provider))) notFound();
  const pkgs = visiblePackages(game, game.packages);
  const [user, prefs] = await Promise.all([getCurrentUser(), getPrefs()]);
  const ptsCfg = await pointsConfig();
  const vipInfo = user && ptsCfg.enabled ? await userTier(user.id) : null;
  const t = dict(prefs.lang);
  const flashMap = await liveFlashMap(pkgs.map((p) => p.id));
  const flashEnds = flashMap.size ? [...flashMap.values()].map((f) => f.endsAt).sort((a, b) => a.getTime() - b.getTime())[0] : null;
  let wishedGame = false;
  let notifySub = false;
  let initialPkgId: number | undefined = pkgParam ? pkgs.find((p) => p.id === Number(pkgParam))?.id : undefined;
  let initialFields: Record<string, string> | undefined;
  if (user) {
    const [wishedRow, notifyRow, quickOrder] = await Promise.all([
      prisma.wishlistItem.findUnique({ where: { userId_gameId: { userId: user.id, gameId: game.id } }, select: { id: true } }),
      prisma.gameNotifySub.findUnique({ where: { userId_gameId: { userId: user.id, gameId: game.id } }, select: { id: true } }),
      quick
        ? prisma.order.findFirst({ where: { userId: user.id, gameId: game.id, status: "DELIVERED" }, orderBy: { createdAt: "desc" }, include: { items: { take: 1 } } })
        : Promise.resolve(null),
    ]);
    wishedGame = !!wishedRow;
    notifySub = !!notifyRow;
    const quickPkgId = quickOrder?.items[0]?.packageId;
    if (!initialPkgId && quickPkgId && pkgs.some((p) => p.id === quickPkgId)) initialPkgId = quickPkgId;
    const qf = quickOrder?.items[0]?.fieldsJson;
    initialFields = qf && typeof qf === "object" ? (qf as Record<string, string>) : undefined;
  }
  const fields = (game.fieldsJson as Array<{ key: string; label: string; required: boolean; placeholder?: string; options?: string[] }>) ?? [];
  const methodFields = (game.methodFieldsJson as Record<string, Array<{ key: string; label: string; required: boolean; placeholder?: string; options?: string[] }>> | null) ?? {};
  const regionCount = new Set(pkgs.map((p) => p.region)).size;
  const locale = prefs.lang === "en" ? "en-US" : "vi-VN";
  const hasUid = pkgs.some((p) => /uid/i.test(p.method));
  const hasLogin = pkgs.some((p) => /login/i.test(p.method));
  const guideSteps = hasUid ? parseUidGuide(game.uidGuideJson) : [];
  const [reviewRows, starGroups, myOrder] = await Promise.all([
    prisma.review.findMany({ where: { gameId: game.id }, orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { name: true } }, order: { select: { totalCents: true } } } }),
    prisma.review.groupBy({ by: ["stars"], where: { gameId: game.id }, _count: { _all: true } }),
    user ? prisma.order.findFirst({ where: { userId: user.id, gameId: game.id, status: "DELIVERED", review: null }, orderBy: { createdAt: "desc" }, select: { id: true, code: true } }) : Promise.resolve(null),
  ]);
  const starCount = (n: number) => starGroups.find((g) => g.stars === n)?._count._all ?? 0;
  const myVotes = user && reviewRows.length
    ? new Set((await prisma.reviewVote.findMany({ where: { userId: user.id, reviewId: { in: reviewRows.map((r) => r.id) } }, select: { reviewId: true } })).map((v) => v.reviewId))
    : new Set<number>();
  const en = prefs.lang === "en";
  const starCounts: Record<number, number> = { 1: starCount(1), 2: starCount(2), 3: starCount(3), 4: starCount(4), 5: starCount(5) };
  const reviewsNode = (
    <Reviews
      slug={game.slug}
      ratingAvg={game.ratingAvg}
      ratingCount={game.ratingCount}
      reviewRows={reviewRows}
      starCounts={starCounts}
      myOrder={myOrder}
      myVotes={myVotes}
      perReview={ptsCfg.enabled ? ptsCfg.perReview : 0}
      cur={prefs.cur}
      lang={prefs.lang}
    />
  );

  if (game.slug === STEAM_SLUG) {
    const cfg = await steamConfig();
    if (!cfg.enabled) notFound();
    const vndRate = prefs.currencies.find((c) => c.code === "VND")?.ratePerUsd ?? 26000;
    return (
      <main className="section" style={{ paddingTop: 24 }}>
        <div className="container">
          <p className="crumb">
            <Link href="/">{t.nav_home}</Link> / <Link href="/games">{t.all_games}</Link> / <span>{game.name}</span>
          </p>
          {err && <div className="form-err" style={{ maxWidth: 600, margin: "0 auto 16px" }}>{err}</div>}
          {msg && <div className="form-ok" style={{ maxWidth: 600, margin: "0 auto 16px" }}>{msg}</div>}
          <SteamTopup
            loggedIn={!!user}
            balanceCents={user?.balanceCents ?? 0}
            unitPriceCents={cfg.unitPriceCents}
            receiveRateVnd={cfg.receiveRateVnd}
            vndRatePerUsd={vndRate}
            minCents={cfg.minCents}
            maxCents={cfg.maxCents}
            cur={prefs.cur}
            lang={prefs.lang}
          />
          {game.description && (
            <div style={{ maxWidth: 600, margin: "18px auto 0" }}>
            </div>
          )}
          <div style={{ maxWidth: 600, margin: "0 auto" }}>{reviewsNode}</div>
        </div>
      </main>
    );
  }

  if (game.slug === GIFT_SLUG) {
    const cfg = await giftConfig();
    if (!cfg.enabled) notFound();
    const [giftRows, giftTotal] = await Promise.all([
      prisma.steamGiftGame.findMany({ where: { active: true }, select: { appid: true, name: true }, orderBy: { rank: "asc" }, take: 24 }),
      prisma.steamGiftGame.count({ where: { active: true } }),
    ]);
    return (
      <main className="section" style={{ paddingTop: 24 }}>
        <div className="container">
          <p className="crumb">
            <Link href="/">{t.nav_home}</Link> / <Link href="/games">{t.all_games}</Link> / <span>{game.name}</span>
          </p>
          {err && <div className="form-err" style={{ maxWidth: 1080, margin: "0 auto 16px" }}>{err}</div>}
          {msg && <div className="form-ok" style={{ maxWidth: 1080, margin: "0 auto 16px" }}>{msg}</div>}
          <SteamGift
            loggedIn={!!user}
            balanceCents={user?.balanceCents ?? 0}
            initialGames={giftRows.map((g) => ({ appid: g.appid, name: g.name, image: giftGameImage(g.appid) }))}
            totalGames={giftTotal}
            cur={prefs.cur}
            lang={prefs.lang}
          />
          {game.description && (
            <div style={{ maxWidth: 1080, margin: "18px auto 0" }}>
            </div>
          )}
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>{reviewsNode}</div>
        </div>
      </main>
    );
  }

  if (game.slug === TG_SLUG) {
    const cfg = await telegramConfig();
    if (!cfg.enabled) notFound();
    const packs = await telegramPackages();
    return (
      <main className="section" style={{ paddingTop: 24 }}>
        <div className="container">
          <p className="crumb">
            <Link href="/">{t.nav_home}</Link> / <Link href="/games">{t.all_games}</Link> / <span>{game.name}</span>
          </p>
          <div className="game-top">
            <div className="game-top-body">
              <div className="game-top-row">
                {game.cover ? (
                  <img className="game-top-logo" src={game.cover} alt={game.name} referrerPolicy="no-referrer" />
                ) : (
                  <div className="game-top-logo game-top-logo--empty" aria-hidden>T</div>
                )}
                <div className="game-top-titles">
                  <h1 title={game.name}>{game.name}</h1>
                  <div className="head-tags">
                    <span className="badge">{en ? "Stars & Premium" : "Sao & Premium"}</span>
                    <span className="badge gray">Global</span>
                  </div>
                </div>
              </div>
              <div className="head-meta">
                <span className="badge gray">★ {game.ratingAvg > 0 ? game.ratingAvg.toFixed(1) : "5.0"} ({game.ratingCount.toLocaleString(locale)})</span>
                <span className="badge gray"><IcoBag />{t.sold} {game.soldCount.toLocaleString(locale)}</span>
                <span className="badge green"><IcoBolt /><span className="del-full">{t.auto_delivery}</span><span className="del-short">{t.auto_delivery_short}</span></span>
              </div>
            </div>
          </div>
          {err && <div className="form-err" style={{ marginTop: 16 }}>{err}</div>}
          {msg && <div className="form-ok" style={{ marginTop: 16 }}>{msg}</div>}
          <div style={{ marginTop: 16 }}>
            <Telegram
              stars={packs.stars}
              premium={packs.premium}
              loggedIn={!!user}
              balanceCents={user?.balanceCents ?? 0}
              cur={prefs.cur}
              lang={prefs.lang}
            />
          </div>
          {reviewsNode}
        </div>
      </main>
    );
  }

  return (
    <main className="section" style={{ paddingTop: 24 }}>
      <div className="container">
        <p className="crumb">
          <Link href="/">{t.nav_home}</Link> / <Link href="/games">{t.all_games}</Link> / <span>{game.name}</span>
        </p>
        <div className="game-top">
          {game.bannerUrl ? (
            <div className="game-top-banner">
              <img src={game.bannerUrl} alt={game.name} referrerPolicy="no-referrer" />
              <div className="wish-float" style={{ display: "flex", gap: 8 }}>
                <GameNotifyBtn gameId={game.id} initial={notifySub} loggedIn={!!user} />
                <WishlistBtn gameId={game.id} initial={wishedGame} loggedIn={!!user} />
              </div>
            </div>
          ) : (
            <div className="wish-float" style={{ display: "flex", gap: 8 }}>
              <GameNotifyBtn gameId={game.id} initial={notifySub} loggedIn={!!user} />
              <WishlistBtn gameId={game.id} initial={wishedGame} loggedIn={!!user} />
            </div>
          )}
          <div className="game-top-body">
            <div className="game-top-row">
              {game.cover ? (
                <img className="game-top-logo" src={game.cover} alt={game.name} referrerPolicy="no-referrer" />
              ) : (
                <div className="game-top-logo game-top-logo--empty" aria-hidden>{game.name.trim().charAt(0).toUpperCase() || "?"}</div>
              )}
              <div className="game-top-titles">
                <h1 title={game.name}>{game.name}</h1>
                <div className="head-tags">
                  {game.genre && <span className="badge">{game.genre}</span>}
                  <span className="badge gray">{regionCount} {t.regions_n}</span>
                </div>
              </div>
            </div>
            <div className="head-meta">
              <span className="badge gray">★ {game.ratingAvg > 0 ? game.ratingAvg.toFixed(1) : "5.0"} ({game.ratingCount.toLocaleString(locale)})</span>
              <span className="badge gray"><IcoBag />{t.sold} {game.soldCount.toLocaleString(locale)}</span>
              {hasUid ? <span className="badge green"><IcoBolt /><span className="del-full">{t.auto_delivery}</span><span className="del-short">{t.auto_delivery_short}</span></span> : hasLogin ? <span className="badge amber"><IcoClock /><span className="del-full">{t.delivery_login}</span><span className="del-short">{t.delivery_login_short}</span></span> : null}
              {guideSteps.length > 0 && <UidGuide steps={guideSteps} label={t.uid_guide} closeLabel={t.uid_guide_close} />}
              {flashEnds && <span className="badge" style={{ background: "#D92D20", color: "#fff" }}>FLASH SALE — kết thúc {flashEnds.toLocaleString(locale)}</span>}
            </div>
          </div>
        </div>
        {game.description && <DescCard title={en ? "Product description" : "Mô tả sản phẩm"} text={game.description} />}
        {err && <div className="form-err" style={{ marginTop: 16 }}>{err}</div>}
        {msg && <div className="form-ok" style={{ marginTop: 16 }}>{msg}</div>}
        <BuyPanel
          slug={game.slug}
          cover={game.cover}
          loggedIn={!!user}
          userPoints={user?.points ?? 0}
          pointsEnabled={ptsCfg.enabled}
          pointsMaxPct={ptsCfg.maxPayPercent}
          vipName={vipInfo?.tier && vipInfo.tier.discountPercent > 0 ? vipInfo.tier.name : null}
          vipPct={vipInfo?.tier?.discountPercent ?? 0}
          fields={fields}
          methodFields={methodFields}
          cur={prefs.cur}
          lang={prefs.lang}
          t={t}
          packages={pkgs.map((p) => {
            const f = flashMap.get(p.id);
            return {
              id: p.id, name: p.name, region: p.region, method: p.method,
              priceCents: f ? f.salePriceCents : p.priceCents,
              listPriceCents: f ? Math.max(p.listPriceCents ?? 0, p.priceCents) : p.listPriceCents,
              imageUrl: p.imageUrl,
            };
          })}
          initialPkgId={initialPkgId}
          initialFields={initialFields}
        />

        {reviewsNode}
      </div>
    </main>
  );
}

export default async function GamePage(props: { params: Promise<{ slug: string }>; searchParams: Promise<{ err?: string; msg?: string; pkg?: string; quick?: string }> }) {
  const { slug } = await props.params;
  const seo = await getGameSeo(slug).catch(() => null);
  const prefs = await getPrefs().catch(() => null);
  const ld = seo ? gameJsonLd(seo, prefs?.lang === "en") : null;
  return (
    <>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />}
      <GamePageInner {...props} />
    </>
  );
}
