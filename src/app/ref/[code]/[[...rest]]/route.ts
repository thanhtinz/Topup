import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { creatorConfig, getCreatorByCode, recordClick, setAttribution } from "@/lib/creator";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string; rest?: string[] }> }) {
  const { code, rest } = await params;
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "bntgame.com";
  const origin = `${proto}://${host}`;
  const home = new URL("/", origin);
  const cfg = await creatorConfig();
  if (!cfg.enabled) return NextResponse.redirect(home);

  const upper = decodeURIComponent(code).toUpperCase();
  const khMatch = /^KH(\d+)$/.exec(upper);
  if (khMatch) {
    const { ensureLegacyCreator } = await import("@/lib/creator");
    await ensureLegacyCreator(parseInt(khMatch[1], 10)).catch(() => undefined);
  }
  let link = await prisma.creatorLink.findUnique({ where: { code: upper }, include: { creator: true } });
  if (!link) {
    const creator = await getCreatorByCode(upper);
    if (creator && creator.status === "ACTIVE") {
      link = await prisma.creatorLink.upsert({
        where: { code: creator.code },
        create: { creatorId: creator.id, code: creator.code, name: "Link mặc định", destination: "/" },
        update: {},
        include: { creator: true },
      });
    }
  }
  if (!link || !link.active || link.creator.status !== "ACTIVE") return NextResponse.redirect(home);

  const visitorId = req.cookies.get("tp_vid")?.value || `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  await recordClick(link.id, link.creatorId, visitorId, ip, req.headers.get("user-agent") || "").catch(() => undefined);

  const user = await getCurrentUser().catch(() => null);
  if (user) await setAttribution(user.id, link.creatorId, link.id, "LINK").catch(() => undefined);

  let dest = link.destination && link.destination.startsWith("/") && !link.destination.startsWith("//") ? link.destination : "/";
  if (rest && rest.length > 0) dest = `/game/${rest.map((s) => encodeURIComponent(s)).join("/")}`;
  else if (link.campaignId) dest = dest; 

  const res = NextResponse.redirect(new URL(dest, origin));
  res.cookies.set("tp_vid", visitorId, { path: "/", maxAge: 365 * 24 * 3600, sameSite: "lax" });
  res.cookies.set("tp_ref", link.code, { path: "/", maxAge: cfg.attributionDays * 24 * 3600, sameSite: "lax" });
  return res;
}
