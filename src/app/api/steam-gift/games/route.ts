import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { giftConfig, giftGameImage } from "@/lib/steamgift";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ games: [], total: 0 }, { status: 401 });
  const cfg = await giftConfig();
  if (!cfg.enabled) return NextResponse.json({ games: [], total: 0 }, { status: 404 });
  const q = String(new URL(req.url).searchParams.get("q") || "").trim().slice(0, 80);
  const where: Record<string, unknown> = { active: true };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      ...(/^\d+$/.test(q) ? [{ appid: parseInt(q, 10) }] : []),
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.steamGiftGame.count({ where }),
    prisma.steamGiftGame.findMany({
      where,
      select: { appid: true, name: true },
      orderBy: { rank: "asc" },
      take: q ? 60 : 24,
    }),
  ]);
  return NextResponse.json({
    games: rows.map((g) => ({ appid: g.appid, name: g.name, image: giftGameImage(g.appid) })),
    total,
    truncated: total > rows.length,
  });
}
