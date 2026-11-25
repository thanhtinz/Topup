import { prisma } from "@/lib/db";
import { apiOk, withApiKey } from "@/lib/apikeys";
import { gameVisible } from "@/lib/visibility";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withApiKey(req, async () => {
    const games = await prisma.game.findMany({
      where: { active: true },
      orderBy: [{ soldCount: "desc" }, { name: "asc" }],
      include: {
        packages: {
          where: { active: true, priceCents: { gt: 0 } },
          orderBy: { priceCents: "asc" },
          select: { id: true, name: true, region: true, method: true, priceCents: true, listPriceCents: true, provider: true },
        },
      },
    });
    const data = games
      .filter((g) => g.packages.length > 0 && gameVisible(g, g.packages.map((p) => p.provider)))
      .map((g) => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
        genre: g.genre,
        regions: g.regions,
        fields: g.fieldsJson,
        methodFields: g.methodFieldsJson ?? {},
        packages: g.packages.map((p) => ({
          id: p.id,
          name: p.name,
          region: p.region,
          method: p.method,
          priceCents: p.priceCents,
          listPriceCents: p.listPriceCents,
          currency: "USD",
        })),
      }));
    return apiOk({ games: data });
  });
}
