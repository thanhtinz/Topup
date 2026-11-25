import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { cookies } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => null);
  return {
    title: s?.seo_title || "BNT Game — Nạp game tự động",
    description: s?.seo_description || "Nạp game nhanh, giá rõ ràng.",
    keywords: s?.seo_keywords || undefined,
    openGraph: { images: s?.og_image ? [s.og_image] : undefined },
    icons: s?.favicon_url ? { icon: s.favicon_url } : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={(await cookies()).get("tp_lang")?.value === "en" ? "en" : "vi"}>
      <body>
        <noscript>
          <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-PLWSJQ2G" height="0" width="0" style={{ display: "none", visibility: "hidden" }} />
        </noscript>
        {children}
        <Script src="https://www.googletagmanager.com/gtm.js?id=GTM-PLWSJQ2G" strategy="afterInteractive" />
        <Script id="gtm-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());`}
        </Script>
      </body>
    </html>
  );
}
