import Link from "next/link";
import { prisma } from "@/lib/db";
import GameCard from "@/components/GameCard";
import SearchBox from "@/components/SearchBox";
import BannerCarousel from "@/components/BannerCarousel";
import { getSettings } from "@/lib/settings";
import { gameVisible, visiblePackages } from "@/lib/visibility";
import { getPrefs } from "@/lib/prefs";
import { dict } from "@/lib/i18n";
import { fmtMoney } from "@/lib/moneyfmt";
import { steamConfig, STEAM_SLUG } from "@/lib/steam";
import { giftConfig, GIFT_SLUG } from "@/lib/steamgift";
import { telegramConfig, TG_SLUG } from "@/lib/telegram";
import { creatorConfig, getPartnerCreators } from "@/lib/creator";
import PartnerGrid from "./creators/PartnerGrid";
import type { Metadata } from "next";
import { SITE_BASE, homeJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => null);
  const title = s?.seo_title || "BNTGame — Nạp game giá rẻ, giao tự động 24/7";
  const description = s?.seo_description || "Nạp game giá rẻ tại BNTGame: giá rõ ràng, giao tự động trong vài giây, thanh toán ví & QR, hỗ trợ 24/7.";
  return {
    title,
    description,
    keywords: s?.seo_keywords || undefined,
    alternates: { canonical: SITE_BASE + "/" },
    openGraph: {
      title,
      description,
      url: SITE_BASE + "/",
      siteName: "BNTGame",
      type: "website",
      images: s?.og_image ? [{ url: s.og_image }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: s?.og_image ? [s.og_image] : undefined },
  };
}


async function genreChips(): Promise<string[]> {
  const rows = await prisma.game.findMany({ where: { active: true }, select: { genre: true }, distinct: ["genre"] }).catch(() => [] as { genre: string }[]);
  return ["Tất cả", ...rows.map((r) => r.genre).filter(Boolean)];
}

async function gamesWithPrice(where: object, take: number, orderBy: object) {
  const games = await prisma.game.findMany({
    where: { active: true, ...where },
    include: { packages: { where: { active: true }, orderBy: { priceCents: "asc" } } },
    take: take * 2,
    orderBy,
  });
  return games
    .filter((g) => g.slug !== GIFT_SLUG && gameVisible(g, g.packages.map((p) => p.provider)))
    .slice(0, take)
    .map((g) => ({ slug: g.slug, name: g.name, cover: g.cover, regions: g.regions, fromCents: visiblePackages(g, g.packages)[0]?.priceCents ?? null, ratingAvg: g.ratingAvg, ratingCount: g.ratingCount, soldCount: g.soldCount }));
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ genre?: string }> }) {
  const { genre } = await searchParams;
  const s = await getSettings();
  const prefs = await getPrefs();
  const t = dict(prefs.lang);
  const partnerCreators = s.module_creator === "1" ? await getPartnerCreators(10).catch(() => []) : [];
  const topSlides = s.module_banner === "1" ? await (async () => {
    const games = await prisma.game.findMany({
      where: { active: true, cover: { not: "" } },
      include: { packages: { where: { active: true }, orderBy: { priceCents: "asc" } } },
      orderBy: { soldCount: "desc" },
      take: 10,
    });
    return games
      .filter((g) => gameVisible(g, g.packages.map((p) => p.provider)) && visiblePackages(g, g.packages).length > 0 && !!g.bannerUrl)
      .slice(0, 5)
      .map((g) => {
        const pkgs = visiblePackages(g, g.packages);
        const min = pkgs[0].priceCents;
        const max = pkgs[pkgs.length - 1].priceCents;
        const fromWord = prefs.lang === "en" ? "From" : "Từ";
        return {
          gameSlug: g.slug,
          gameName: g.name,
          image: g.bannerUrl as string,
          icon: g.cover,
          priceLabel: min === max ? `${fromWord} ${fmtMoney(min, prefs.cur, prefs.lang)}` : `${fromWord} ${fmtMoney(min, prefs.cur, prefs.lang)} – ${fmtMoney(max, prefs.cur, prefs.lang)}`,
        };
      });
  })() : [];
  const genreWhere = genre && genre !== "Tất cả" ? { genre } : {};
  const GENRES = await genreChips();
  const heroTitle = (prefs.lang === "en" ? s.hero_title_en : s.hero_title)?.trim() || t.hero_title;
  const heroSub = (prefs.lang === "en" ? s.hero_sub_en : s.hero_sub)?.trim() || t.hero_sub;
  const bestRaw = await gamesWithPrice(genreWhere, 12, { soldCount: "desc" });
  const steamCfg = await steamConfig();
  const steamGame = steamCfg.enabled
    ? await prisma.game.findUnique({ where: { slug: STEAM_SLUG }, select: { slug: true, name: true, cover: true, regions: true, ratingAvg: true, ratingCount: true, soldCount: true, active: true } })
    : null;
  const giftCfg = await giftConfig();
  const giftGame = giftCfg.enabled
    ? await prisma.game.findUnique({ where: { slug: GIFT_SLUG }, select: { slug: true, name: true, cover: true, regions: true, ratingAvg: true, ratingCount: true, soldCount: true, active: true } })
    : null;
  const tgCfg = await telegramConfig();
  const tgGame = tgCfg.enabled
    ? await prisma.game.findUnique({ where: { slug: TG_SLUG }, select: { slug: true, name: true, cover: true, regions: true, ratingAvg: true, ratingCount: true, soldCount: true, active: true, id: true } })
    : null;
  const tgFromCents = tgGame?.active
    ? (await prisma.package.findFirst({ where: { gameId: tgGame.id, active: true }, orderBy: { priceCents: "asc" }, select: { priceCents: true } }))?.priceCents ?? null
    : null;
  const pinned = [
    ...(steamGame?.active ? [{ slug: steamGame.slug, name: steamGame.name, cover: steamGame.cover, regions: steamGame.regions, fromCents: steamCfg.unitPriceCents, ratingAvg: steamGame.ratingAvg, ratingCount: steamGame.ratingCount, soldCount: steamGame.soldCount }] : []),
    ...(giftGame?.active ? [{ slug: giftGame.slug, name: giftGame.name, cover: giftGame.cover, regions: giftGame.regions, fromCents: null as number | null, ratingAvg: giftGame.ratingAvg, ratingCount: giftGame.ratingCount, soldCount: giftGame.soldCount }] : []),
    ...(tgGame?.active ? [{ slug: tgGame.slug, name: tgGame.name, cover: tgGame.cover, regions: tgGame.regions, fromCents: tgFromCents, ratingAvg: tgGame.ratingAvg, ratingCount: tgGame.ratingCount, soldCount: tgGame.soldCount }] : []),
  ];
  const best = pinned.length
    ? [...pinned, ...bestRaw.filter((g) => g.slug !== STEAM_SLUG && g.slug !== GIFT_SLUG && g.slug !== TG_SLUG)].slice(0, 12)
    : bestRaw;
  let newest = await gamesWithPrice({ isNew: true, ...genreWhere }, 6, { createdAt: "desc" });
  if (!newest.length) newest = await gamesWithPrice(genreWhere, 6, { createdAt: "desc" });
  const total = await prisma.game.count({ where: { active: true } });
  const { liveFlashMap } = await import("@/lib/flashsale");
  const flashMap = await liveFlashMap();
  const flashPkgs = flashMap.size
    ? await prisma.package.findMany({ where: { id: { in: [...flashMap.keys()] }, active: true }, include: { game: { select: { name: true, slug: true, cover: true } } }, take: 8 })
    : [];

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd()) }} />
      <BannerCarousel banners={topSlides} />

      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">{t.eyebrow}</span>
            <h1 className="display">{heroTitle}</h1>
            <p className="lede">{heroSub}</p>
            <SearchBox placeholder={t.search_ph} />
          </div>
        </div>
      </section>

      <section className="genres" aria-label="Thể loại">
        <div className="container">
          <div className="genres-row">
            {GENRES.map((g) => (
              <Link key={g} className="chip" aria-pressed={(!genre && g === "Tất cả") || genre === g} href={g === "Tất cả" ? "/" : `/?genre=${encodeURIComponent(g)}`}>
                {g === "Tất cả" && prefs.lang === "en" ? "All" : g}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {flashPkgs.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head">
              <div>
                <h2 style={{ color: "#D92D20" }}>Flash Sale</h2>
                <p>Giá sốc trong thời gian ngắn — hết giờ hoặc hết suất là về giá thường.</p>
              </div>
              <Link className="see-all" href="/flash-sale">Xem tất cả
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
              </Link>
            </div>
            <div className="flash-grid">
              {flashPkgs.map((p) => {
                const f = flashMap.get(p.id)!;
                const off = Math.max(0, Math.round((1 - f.salePriceCents / p.priceCents) * 100));
                return (
                  <Link key={p.id} className="flash-card" href={`/game/${p.game.slug}?pkg=${p.id}`}>
                    {p.imageUrl || p.game.cover ? <img src={p.imageUrl || p.game.cover} alt="" loading="lazy" referrerPolicy="no-referrer" /> : null}
                    <div className="flash-body">
                      <b>{p.name}</b>
                      <span className="muted">{p.game.name}</span>
                      <span className="flash-price">{fmtMoney(f.salePriceCents, prefs.cur, prefs.lang)} <s>{fmtMoney(p.priceCents, prefs.cur, prefs.lang)}</s></span>
                      <span className="flash-meta">
                        <span className="flash-off">-{off}%</span>
                        {f.stockLimit != null && <span className="muted">Còn {Math.max(0, f.stockLimit - f.soldCount)}/{f.stockLimit} suất</span>}
                        <span className="muted">Đến {f.endsAt.toLocaleString(prefs.lang === "en" ? "en-US" : "vi-VN")}</span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="section" id="ban-chay" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <div>
              <h2>{t.best_title}</h2>
              <p>{t.best_sub}</p>
            </div>
            <Link className="see-all" href="/games">{t.view_all}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
            </Link>
          </div>
          <div className="grid">
            {best.map((g) => <GameCard key={g.slug} game={g} cur={prefs.cur} lang={prefs.lang} t={t} />)}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="trust">
            <div className="trust-item">
              <div className="trust-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z"/></svg></div>
              <div><h3>{t.ht1_t}</h3><p>{t.ht1_d}</p></div>
            </div>
            <div className="trust-item">
              <div className="trust-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 3l7 3v5c0 5-3.2 8.2-7 10-3.8-1.8-7-5-7-10V6l7-3z"/><path d="m9 11.5 2.2 2.2L15.5 9.5" strokeLinecap="round"/></svg></div>
              <div><h3>{t.ht2_t}</h3><p>{t.ht2_d}</p></div>
            </div>
            <div className="trust-item">
              <div className="trust-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 0-3.5 7.1L21 20l-.8-3.2c.5-1.5.8-3.1.8-4.8z"/><path d="M8.5 10.5h7M8.5 14h4"/></svg></div>
              <div><h3>{t.ht3_t}</h3><p>{t.ht3_d}</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="moi-them" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <div>
              <h2>{t.new_title}</h2>
              <p>{t.new_sub}</p>
            </div>
            <Link className="see-all" href="/games">{t.view_all}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
            </Link>
          </div>
          <div className="grid">
            {newest.map((g) => <GameCard key={g.slug} game={g} cur={prefs.cur} lang={prefs.lang} t={t} />)}
          </div>
          <div className="grid-cta">
            <Link className="btn btn-outline" href="/games">{t.view_all} {total} {t.games_word}</Link>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <div>
              <h2>{t.how_title}</h2>
              <p>{t.how_sub}</p>
            </div>
          </div>
          <div className="steps">
            <div className="step"><div className="num">01</div><h3>{t.hs1_t}</h3><p>{t.hs1_d}</p></div>
            <div className="step"><div className="num">02</div><h3>{t.hs2_t}</h3><p>{t.hs2_d}</p></div>
            <div className="step"><div className="num">03</div><h3>{t.hs3_t}</h3><p>{t.hs3_d}</p></div>
          </div>
        </div>
      </section>

      {partnerCreators.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head">
              <div>
                <h2>Đồng hành cùng BNTGame</h2>
                <p>Các Affiliate có doanh số cao đang hợp tác cùng BNTGame — bấm vào từng Affiliate để xem kênh của họ.</p>
              </div>
            </div>
            <PartnerGrid creators={partnerCreators} />
            <div className="grid-cta">
              <Link className="btn btn-outline" href="/creators/partners">Xem tất cả Affiliate</Link>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
