import { prisma } from "./db";

export type FlashInfo = {
  itemId: number;
  saleId: number;
  saleName: string;
  salePriceCents: number;
  stockLimit: number | null;
  soldCount: number;
  endsAt: Date;
  startsAt: Date;
};

export async function liveFlashMap(packageIds?: number[]): Promise<Map<number, FlashInfo>> {
  const now = new Date();
  const items = await prisma.flashSaleItem.findMany({
    where: {
      packageId: packageIds ? { in: packageIds } : undefined,
      flashSale: { active: true, startsAt: { lte: now }, endsAt: { gt: now } },
    },
    include: { flashSale: { select: { id: true, name: true, endsAt: true, startsAt: true } } },
    orderBy: { salePriceCents: "asc" },
  });
  const map = new Map<number, FlashInfo>();
  for (const it of items) {
    if (map.has(it.packageId)) continue; 
    if (it.stockLimit != null && it.soldCount >= it.stockLimit) continue;
    map.set(it.packageId, {
      itemId: it.id,
      saleId: it.flashSale.id,
      saleName: it.flashSale.name,
      salePriceCents: it.salePriceCents,
      stockLimit: it.stockLimit,
      soldCount: it.soldCount,
      endsAt: it.flashSale.endsAt,
      startsAt: it.flashSale.startsAt,
    });
  }
  return map;
}

export async function liveFlashForPackage(packageId: number): Promise<FlashInfo | null> {
  const map = await liveFlashMap([packageId]);
  return map.get(packageId) ?? null;
}
