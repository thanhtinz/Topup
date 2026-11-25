import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { TYPE_SLUGS } from "@/lib/partnership";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bntgame.com";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const statics: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/games`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/flash-sale`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/partnership`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/creators`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/api-docs`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/status`, lastModified: now, changeFrequency: "daily", priority: 0.4 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
  const [games, posts] = await Promise.all([
    prisma.game.findMany({ where: { active: true }, select: { slug: true, createdAt: true }, orderBy: { soldCount: "desc" } }).catch(() => []),
    prisma.post.findMany({ where: { published: true }, select: { slug: true, publishedAt: true }, orderBy: { publishedAt: "desc" } }).catch(() => []),
  ]);
  const gameUrls: MetadataRoute.Sitemap = games.map((g) => ({
    url: `${BASE}/game/${g.slug}`,
    lastModified: g.createdAt,
    changeFrequency: "daily",
    priority: 0.8,
  }));
  const postUrls: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: p.publishedAt ?? now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));
  const typeUrls: MetadataRoute.Sitemap = Object.values(TYPE_SLUGS).map((slug) => ({
    url: `${BASE}/partnership/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));
  return [...statics, ...gameUrls, ...postUrls, ...typeUrls];
}
