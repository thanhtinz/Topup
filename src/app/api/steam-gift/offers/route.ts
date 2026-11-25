import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { giftConfig, giftOffersPriced } from "@/lib/steamgift";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ offers: [] }, { status: 401 });
  const cfg = await giftConfig();
  if (!cfg.enabled) return NextResponse.json({ offers: [] }, { status: 404 });
  const appidRaw = String(new URL(req.url).searchParams.get("appid") || "").trim();
  if (!/^\d+$/.test(appidRaw)) return NextResponse.json({ offers: [] }, { status: 400 });
  const offers = await giftOffersPriced(parseInt(appidRaw, 10));
  if (!offers) return NextResponse.json({ offers: [], unavailable: true });
  return NextResponse.json({ offers });
}
