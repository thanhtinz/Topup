import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPrefs } from "@/lib/prefs";
import { dict } from "@/lib/i18n";
import { gameVisible } from "@/lib/visibility";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json([]);
  const prefs = await getPrefs();
  const t = dict(prefs.lang);
  const found = await prisma.game.findMany({
    where: { active: true, name: { contains: q, mode: "insensitive" } },
    include: { packages: { where: { active: true }, select: { provider: true } } },
    take: 12,
    orderBy: { soldCount: "desc" },
  });
  const games = found.filter((g) => gameVisible(g, g.packages.map((p) => p.provider))).slice(0, 6);
  return NextResponse.json(
    games.map((g) => {
      const isMethod = g.regions.some((r) => r === "UID" || r.includes("Login"));
      return {
        slug: g.slug,
        name: g.name,
        cover: g.cover,
        meta: `${g.regions.length} ${isMethod ? t.search_meta_methods : t.search_meta_regions}`,
      };
    }),
  );
}
