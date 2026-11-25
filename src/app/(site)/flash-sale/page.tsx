import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPrefs } from "@/lib/prefs";
import { fmtMoney } from "@/lib/moneyfmt";
import { liveFlashMap } from "@/lib/flashsale";

export const dynamic = "force-dynamic";

export default async function FlashSalePage() {
  const prefs = await getPrefs();
  const locale = prefs.lang === "en" ? "en-US" : "vi-VN";
  const now = new Date();
  const flashMap = await liveFlashMap();
  const livePkgs = flashMap.size
    ? await prisma.package.findMany({ where: { id: { in: [...flashMap.keys()] }, active: true }, include: { game: { select: { name: true, slug: true, cover: true } } } })
    : [];
  const upcoming = await prisma.flashSale.findMany({
    where: { active: true, startsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    take: 5,
    include: { items: { include: { package: { select: { name: true, priceCents: true, game: { select: { name: true, slug: true } } } } } } },
  });

  return (
    <main className="bsx">
      <div className="container" style={{ maxWidth: 1000, paddingTop: 28, paddingBottom: 52 }}>
        <h1 style={{ fontSize: 26, color: "#D92D20", marginBottom: 6 }}>Flash Sale</h1>
        <p className="muted" style={{ marginBottom: 20 }}>Giá sốc theo khung giờ — số lượng có hạn, hết giờ hoặc hết suất là trở về giá thường. Giá cuối cùng được xác nhận ở bước thanh toán.</p>

        {livePkgs.length === 0 ? (
          <div className="crt-card" style={{ textAlign: "center", padding: "30px 20px" }}>
            <p className="muted">Hiện không có Flash Sale nào đang chạy. Quay lại sau nhé!</p>
          </div>
        ) : (
          <div className="flash-grid">
            {livePkgs.map((p) => {
              const f = flashMap.get(p.id)!;
              const off = Math.max(0, Math.round((1 - f.salePriceCents / p.priceCents) * 100));
              return (
                <Link key={p.id} className="flash-card" href={`/game/${p.game.slug}?pkg=${p.id}`}>
                  {p.imageUrl || p.game.cover ? <img src={p.imageUrl || p.game.cover} alt="" loading="lazy" referrerPolicy="no-referrer" /> : null}
                  <div className="flash-body">
                    <b>{p.name}</b>
                    <span className="muted">{p.game.name} · {f.saleName}</span>
                    <span className="flash-price">{fmtMoney(f.salePriceCents, prefs.cur, prefs.lang)} <s>{fmtMoney(p.priceCents, prefs.cur, prefs.lang)}</s></span>
                    <span className="flash-meta">
                      <span className="flash-off">-{off}%</span>
                      {f.stockLimit != null && <span className="muted">Còn {Math.max(0, f.stockLimit - f.soldCount)}/{f.stockLimit} suất</span>}
                      <span className="muted">Kết thúc {f.endsAt.toLocaleString(locale)}</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <h2 style={{ fontSize: 20, margin: "28px 0 12px" }}>Sắp diễn ra</h2>
            {upcoming.map((s) => (
              <div key={s.id} className="crt-card" style={{ marginBottom: 12 }}>
                <strong>{s.name}</strong>
                <span className="muted"> · Bắt đầu {s.startsAt.toLocaleString(locale)} → {s.endsAt.toLocaleString(locale)}</span>
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {s.items.map((it) => (
                    <span key={it.id} style={{ fontSize: 14 }}>
                      <Link href={`/game/${it.package.game.slug}`}>{it.package.name}</Link>
                      <span className="muted"> ({it.package.game.name})</span> — <b style={{ color: "#D92D20" }}>{fmtMoney(it.salePriceCents, prefs.cur, prefs.lang)}</b> <s className="muted">{fmtMoney(it.package.priceCents, prefs.cur, prefs.lang)}</s>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
