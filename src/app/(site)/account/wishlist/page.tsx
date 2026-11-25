import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPrefs } from "@/lib/prefs";
import { fmtMoney } from "@/lib/moneyfmt";
import { removeWishlistAction } from "../engage-actions";

export const dynamic = "force-dynamic";

export default async function WishlistPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const prefs = await getPrefs();
  const { msg, err } = await searchParams;
  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      game: { select: { id: true, name: true, slug: true, cover: true } },
      package: { select: { id: true, name: true, priceCents: true, active: true, game: { select: { name: true, slug: true } } } },
    },
  });
  const games = items.filter((i) => i.game);
  const pkgs = items.filter((i) => i.package);

  return (
    <main className="bsx">
      <div className="container" style={{ maxWidth: 880, paddingTop: 28, paddingBottom: 52 }}>
        <h1 style={{ fontSize: 24, marginBottom: 14 }}>Danh sách yêu thích</h1>
        {msg && <div className="form-ok" style={{ marginBottom: 12 }}>{msg}</div>}
        {err && <div className="form-err" style={{ marginBottom: 12 }}>{err}</div>}
        {items.length === 0 ? (
          <div className="crt-card" style={{ textAlign: "center", padding: "30px 20px" }}>
            <p className="muted" style={{ marginBottom: 12 }}>Bạn chưa yêu thích game hay gói nào. Bấm nút Yêu thích ở trang game để lưu lại tại đây.</p>
            <Link className="btn btn-primary" href="/games">Khám phá game</Link>
          </div>
        ) : (
          <>
            {games.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
                {games.map((i) => (
                  <div key={i.id} className="ptn-card" style={{ padding: 12 }}>
                    <Link href={`/game/${i.game!.slug}`}>
                      {i.game!.cover ? <img src={i.game!.cover} alt="" style={{ width: "100%", borderRadius: 10, aspectRatio: "1", objectFit: "cover" }} referrerPolicy="no-referrer" /> : null}
                      <h3 style={{ fontSize: 14.5, marginTop: 8 }}>{i.game!.name}</h3>
                    </Link>
                    <form action={removeWishlistAction} style={{ marginTop: 8 }}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className="btn btn-outline btn-sm" type="submit" style={{ width: "100%" }}>Bỏ yêu thích</button>
                    </form>
                  </div>
                ))}
              </div>
            )}
            {pkgs.length > 0 && (
              <div className="crt-card">
                <h3 style={{ marginBottom: 10 }}>Gói đã lưu</h3>
                {pkgs.map((i) => (
                  <div key={i.id} className="mini-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #EEF3F9" }}>
                    <div>
                      <Link href={`/game/${i.package!.game.slug}?pkg=${i.package!.id}`}><strong>{i.package!.name}</strong></Link>
                      <br /><span className="muted">{i.package!.game.name} · {fmtMoney(i.package!.priceCents, prefs.cur, prefs.lang)}{i.package!.active ? "" : " · gói đã ngừng bán"}</span>
                    </div>
                    <form action={removeWishlistAction}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className="btn btn-outline btn-sm" type="submit">Bỏ lưu</button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
