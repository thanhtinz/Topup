import { prisma } from "@/lib/db";
import { gameVisible, visiblePackages } from "@/lib/visibility";

export const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bntgame.com";
export const SITE_NAME = "BNTGame";

export function absUrl(u: string | null | undefined): string | undefined {
  if (!u) return undefined;
  if (/^https?:\/\//i.test(u)) return u;
  return SITE_BASE + (u.startsWith("/") ? u : "/" + u);
}

export function trimDesc(text: string, max = 158): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
}

export type GameSeo = {
  name: string;
  slug: string;
  genre: string;
  description: string;
  image: string | undefined;
  minCents: number | null;
  maxCents: number | null;
  pkgCount: number;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
};

export async function getGameSeo(slug: string): Promise<GameSeo | null> {
  const game = await prisma.game.findUnique({
    where: { slug },
    include: { packages: { where: { active: true }, select: { priceCents: true, provider: true } } },
  }).catch(() => null);
  if (!game || !gameVisible(game, game.packages.map((p) => p.provider))) return null;
  const pkgs = visiblePackages(game, game.packages).filter((p) => p.priceCents > 0);
  const prices = pkgs.map((p) => p.priceCents);
  return {
    name: game.name,
    slug: game.slug,
    genre: game.genre,
    description: game.description,
    image: absUrl(game.bannerUrl || game.cover),
    minCents: prices.length ? Math.min(...prices) : null,
    maxCents: prices.length ? Math.max(...prices) : null,
    pkgCount: pkgs.length,
    ratingAvg: game.ratingAvg,
    ratingCount: game.ratingCount,
    soldCount: game.soldCount,
  };
}

export function gameTitle(seo: GameSeo, en: boolean): string {
  return en
    ? `Top Up ${seo.name} — Cheap & Instant Delivery | ${SITE_NAME}`
    : `Nạp ${seo.name} giá rẻ — Giao tự động 24/7 | ${SITE_NAME}`;
}

export function gameDescription(seo: GameSeo, en: boolean): string {
  const own = seo.description?.trim();
  if (own && own.length >= 50) return trimDesc(own);
  const price = seo.minCents != null ? `$${(seo.minCents / 100).toFixed(2)}` : "";
  if (en) {
    return trimDesc(`Top up ${seo.name}${seo.genre ? ` (${seo.genre})` : ""} at ${SITE_NAME}: ${seo.pkgCount} packages${price ? ` from ${price}` : ""}. Instant auto delivery in seconds, pay by wallet or QR, 24/7 support, refund guarantee if delivery fails.`);
  }
  return trimDesc(`Nạp ${seo.name}${seo.genre ? ` (${seo.genre})` : ""} giá rẻ tại ${SITE_NAME}: ${seo.pkgCount} gói nạp${price ? `, giá chỉ từ ${price}` : ""}. Giao tự động trong vài giây, thanh toán bằng ví hoặc QR, hỗ trợ 24/7, hoàn tiền nếu nạp lỗi.`);
}

export function gameJsonLd(seo: GameSeo, en: boolean) {
  const url = `${SITE_BASE}/game/${seo.slug}`;
  const product: Record<string, unknown> = {
    "@type": "Product",
    name: seo.name,
    url,
    description: gameDescription(seo, en),
    category: seo.genre || undefined,
    brand: { "@type": "Brand", name: SITE_NAME },
  };
  if (seo.image) product.image = [seo.image];
  if (seo.ratingCount > 0) {
    product.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: seo.ratingAvg.toFixed(1),
      ratingCount: seo.ratingCount,
    };
  }
  if (seo.minCents != null && seo.maxCents != null && seo.pkgCount > 0) {
    product.offers = {
      "@type": "AggregateOffer",
      url,
      priceCurrency: "USD",
      lowPrice: (seo.minCents / 100).toFixed(2),
      highPrice: (seo.maxCents / 100).toFixed(2),
      offerCount: seo.pkgCount,
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: SITE_NAME },
    };
  }
  const crumbs = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: en ? "Home" : "Trang chủ", item: SITE_BASE + "/" },
      { "@type": "ListItem", position: 2, name: en ? "Games" : "Tất cả game", item: SITE_BASE + "/games" },
      { "@type": "ListItem", position: 3, name: seo.name, item: url },
    ],
  };
  return { "@context": "https://schema.org", "@graph": [product, crumbs] };
}

export function homeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_BASE + "/",
      },
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_BASE + "/",
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${SITE_BASE}/games?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}
