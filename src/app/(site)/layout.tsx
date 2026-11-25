import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FloatingContacts from "@/components/FloatingContacts";
import { getFloatingContacts } from "@/lib/contact";
import { getSettings } from "@/lib/settings";
import { getGoogleConfig } from "@/lib/google";
import { getFacebookConfig } from "@/lib/facebook";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { hasAdmin } from "@/lib/setup";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasAdmin())) redirect("/setup");
  const s = await getSettings().catch(() => ({ site_name: "BNT Game", support_email: "support@bntgame.com", support_widget_enabled: "1", footer_about: "", site_tagline: "", logo_url: "" } as Record<string, string>));
  const contacts = s.support_widget_enabled === "0" ? [] : await getFloatingContacts().catch(() => []);
  const [google, facebook, games] = await Promise.all([
    getGoogleConfig().catch(() => ({ enabled: false }) as { enabled: boolean }),
    getFacebookConfig().catch(() => ({ enabled: false }) as { enabled: boolean }),
    prisma.game.findMany({ where: { active: true, cover: { not: "" } }, orderBy: { soldCount: "desc" }, take: 8, select: { cover: true } }).catch(() => [] as { cover: string }[]),
  ]);
  return (
    <>
      <SiteHeader siteName={s.site_name} logoUrl={s.logo_url} covers={games.map((g) => g.cover)} googleEnabled={google.enabled} facebookEnabled={facebook.enabled} />
      {children}
      <SiteFooter siteName={s.site_name} logoUrl={s.logo_url} supportEmail={s.support_email} about={s.footer_about?.trim() ? s.footer_about : s.site_tagline} contacts={contacts} />
      <FloatingContacts items={contacts} />
    </>
  );
}
