import Link from "next/link";
import { prisma } from "@/lib/db";
import GameCard from "@/components/GameCard";
import { getPrefs } from "@/lib/prefs";
import { dict } from "@/lib/i18n";
import { gameVisible, visiblePackages } from "@/lib/visibility";
import { steamConfig, STEAM_SLUG } from "@/lib/steam";
import { giftConfig, GIFT_SLUG } from "@/lib/steamgift";
import { telegramConfig, TG_SLUG } from "@/lib/telegram";
import SortSelect from "./SortSelect";
import type { Metadata } from "next";
import { SITE_BASE } from "@/lib/seo";
import GenreIcon from "./GenreIcon";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const prefs = await getPrefs().catch(() => null);
  const en = prefs?.lang === "en";
  const title = en ? "All Games — Cheap Game Top Up | BNTGame" : "Tất cả game — Nạp game giá rẻ, giao tự động | BNTGame";
  const description = en
    ? "Browse every game top-up at BNTGame: transparent prices, instant auto delivery, wallet & QR payments, 24/7 support."
    : "Danh sách tất cả game nạp tại BNTGame: giá rõ ràng, giao tự động trong vài giây, thanh toán ví & QR, hỗ trợ 24/7.";
  return {
    title,
    description,
    alternates: { canonical: `${SITE_BASE}/games` },
    openGraph: { title, description, url: `${SITE_BASE}/games`, siteName: "BNTGame", type: "website" },
  };
}


const SORTS = ["popular", "price-asc", "price-desc", "name"] as const;
type Sort = (typeof SORTS)[number];

const PAGE_SIZE = 50;

export default async function GamesPage({ searchParams }: { searchParams: Promise<{ q?: string; genre?: string; sort?: string; page?: string }> }) {
  const { q, genre, sort, page } = await searchParams;
  const prefs = await getPrefs();
  const t = dict(prefs.lang);
  const sortKey: Sort = (SORTS as readonly string[]).includes(sort ?? "") ? (sort as Sort) : "popular";
  const allGames = await prisma.game.findMany({
    where: { active: true, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
    include: { packages: { where: { active: true }, orderBy: { priceCents: "asc" } } },
    orderBy: { soldCount: "desc" },
  });
  const visible = allGames.filter((g) => gameVisible(g, g.packages.map((p) => p.provider)));
  const genreCounts = new Map<string, number>();
  for (const g of visible) if (g.genre) genreCounts.set(g.genre, (genreCounts.get(g.genre) ?? 0) + 1);
  const genres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  const activeGenre = genre && genreCounts.has(genre) ? genre : "";
  const filtered = activeGenre ? visible.filter((g) => g.genre === activeGenre) : visible;
  const minPrice = (g: (typeof filtered)[number]) => (g.slug === GIFT_SLUG ? null : visiblePackages(g, g.packages)[0]?.priceCents ?? null);
  const games = [...filtered].sort((a, b) => {
    if (sortKey === "name") return a.name.localeCompare(b.name);
    if (sortKey === "price-asc" || sortKey === "price-desc") {
      const pa = minPrice(a); const pb = minPrice(b);
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return sortKey === "price-asc" ? pa - pb : pb - pa;
    }
    return b.soldCount - a.soldCount;
  });
  const sortOptions = [
    { value: "popular", label: t.sort_popular },
    { value: "price-asc", label: t.sort_price_asc },
    { value: "price-desc", label: t.sort_price_desc },
    { value: "name", label: t.sort_name_az },
  ];
  const chipHref = (g: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (sortKey !== "popular") p.set("sort", sortKey);
    if (g) p.set("genre", g);
    const qs = p.toString();
    return "/games" + (qs ? `?${qs}` : "");
  };
  const pages = Math.max(1, Math.ceil(games.length / PAGE_SIZE));
  const pageNum = Math.min(pages, Math.max(1, parseInt(page ?? "1", 10) || 1));
  const pageGames = games.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);
  const steamCfg = await steamConfig();
  const steamGame = steamCfg.enabled ? visible.find((g) => g.slug === STEAM_SLUG) : undefined;
  const giftCfg = await giftConfig();
  const giftGame = giftCfg.enabled ? visible.find((g) => g.slug === GIFT_SLUG) : undefined;
  const tgCfg = await telegramConfig();
  const tgGame = tgCfg.enabled ? visible.find((g) => g.slug === TG_SLUG) : undefined;
  const pinnedGames = [steamGame, giftGame, tgGame].filter((g) => g !== undefined);
  const displayGames = pinnedGames.length && pageNum === 1 && (!q || /steam|gift|telegram/i.test(q))
    ? [...pinnedGames, ...pageGames.filter((g) => !pinnedGames.some((pg) => pg.id === g.id))].slice(0, PAGE_SIZE)
    : pageGames;
  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (sortKey !== "popular") p.set("sort", sortKey);
    if (activeGenre) p.set("genre", activeGenre);
    if (n > 1) p.set("page", String(n));
    const qs = p.toString();
    return "/games" + (qs ? `?${qs}` : "");
  };
  return (
    <main className="section">
      <div className="container">
        <h1 className="svc-title">{t.all_services}</h1>
        <p className="svc-found">
          {t.found_label}: <b>{games.length}</b>
          {q ? <> — {t.search_results_for} “{q}”</> : null}
        </p>
        <form className="svc-search" method="get" action="/games" role="search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.8-3.8" /></svg>
          <input name="q" defaultValue={q ?? ""} placeholder={t.search_ph} aria-label={t.search_ph} />
          {activeGenre ? <input type="hidden" name="genre" value={activeGenre} /> : null}
          {sortKey !== "popular" ? <input type="hidden" name="sort" value={sortKey} /> : null}
        </form>
        <SortSelect options={sortOptions} current={sortKey} />
        <div className="gchips">
          <Link className={activeGenre ? "gchip" : "gchip on"} href={chipHref("")} aria-pressed={!activeGenre}>
            <span style={{ paddingLeft: 6 }}>{t.all_word}</span>
            <b>{visible.length}</b>
          </Link>
          {genres.map((g) => (
            <Link key={g.name} className={activeGenre === g.name ? "gchip on" : "gchip"} href={chipHref(g.name)} aria-pressed={activeGenre === g.name}>
              <GenreIcon genre={g.name} />
              <span>{g.name}</span>
              <b>{g.count}</b>
            </Link>
          ))}
        </div>
        <div className="grid">
          {displayGames.map((g) => (
            <GameCard key={g.slug} game={{ slug: g.slug, name: g.name, cover: g.cover, regions: g.regions, fromCents: visiblePackages(g, g.packages)[0]?.priceCents ?? null, ratingAvg: g.ratingAvg, ratingCount: g.ratingCount, soldCount: g.soldCount }} cur={prefs.cur} lang={prefs.lang} t={t} />
          ))}
        </div>
        {!games.length && <p className="muted">Không tìm thấy game nào.</p>}
        {pages > 1 && (
          <nav className="svc-pager" aria-label="Pagination">
            {pageNum > 1 ? <Link className="pg-btn" href={pageHref(pageNum - 1)} aria-label="Trang trước">‹</Link> : <span className="pg-btn off">‹</span>}
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link key={n} className={n === pageNum ? "pg-btn on" : "pg-btn"} href={pageHref(n)} aria-current={n === pageNum ? "page" : undefined}>{n}</Link>
            ))}
            {pageNum < pages ? <Link className="pg-btn" href={pageHref(pageNum + 1)} aria-label="Trang sau">›</Link> : <span className="pg-btn off">›</span>}
          </nav>
        )}
      </div>
    </main>
  );
}
