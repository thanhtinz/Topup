import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPrefs } from "@/lib/prefs";
import { fmtMoney } from "@/lib/moneyfmt";
import { deletePriceAlertAction, reactivatePriceAlertAction, removeGameNotifyAction } from "../engage-actions";

export const dynamic = "force-dynamic";

export default async function PriceAlertsPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const prefs = await getPrefs();
  const { msg, err } = await searchParams;
  const alerts = await prisma.priceAlert.findMany({
    where: { userId: user.id },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    include: { package: { select: { id: true, name: true, priceCents: true, active: true, game: { select: { name: true, slug: true } } } } },
  });
  const gameSubs = await prisma.gameNotifySub.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { game: { select: { name: true, slug: true, cover: true } } },
  });

  return (
    <main className="bsx">
      <div className="container" style={{ maxWidth: 880, paddingTop: 28, paddingBottom: 52 }}>
        <h1 style={{ fontSize: 24, marginBottom: 14 }}>Báo giá đang theo dõi</h1>
        {msg && <div className="form-ok" style={{ marginBottom: 12 }}>{msg}</div>}
        {err && <div className="form-err" style={{ marginBottom: 12 }}>{err}</div>}
        {gameSubs.length > 0 && (
          <>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Game đang nhận thông báo</h2>
            <p className="muted" style={{ marginBottom: 10 }}>Bất kỳ gói nào của các game này giảm giá, bạn sẽ nhận được thông báo. Bật/tắt tại nút chuông ở góc banner trang game.</p>
            <div className="crt-card" style={{ marginBottom: 20 }}>
              {gameSubs.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #EEF3F9", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {s.game.cover ? <img src={s.game.cover} alt="" style={{ width: 38, height: 38, borderRadius: 9, objectFit: "cover" }} referrerPolicy="no-referrer" /> : null}
                    <Link href={`/game/${s.game.slug}`}><strong>{s.game.name}</strong></Link>
                  </div>
                  <form action={removeGameNotifyAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="btn btn-outline btn-sm" type="submit">Tắt thông báo</button>
                  </form>
                </div>
              ))}
            </div>
          </>
        )}
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Báo giá theo gói (đã đặt trước đây)</h2>
        <p className="muted" style={{ marginBottom: 14 }}>Khi gói bạn theo dõi giảm giá, BNTGame sẽ gửi thông báo trong web (và email nếu đã bật). Mỗi báo giá chỉ kích hoạt một lần cho một đợt giảm — bật lại tại đây nếu muốn theo dõi tiếp.</p>
        {alerts.length === 0 ? (
          <div className="crt-card" style={{ textAlign: "center", padding: "30px 20px" }}>
            <p className="muted">Bạn chưa theo dõi giá gói nào. Để nhận thông báo giảm giá của cả game, bấm nút chuông "Nhận thông báo" ở góc banner trang game.</p>
          </div>
        ) : (
          <div className="crt-card">
            {alerts.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #EEF3F9", flexWrap: "wrap" }}>
                <div>
                  <Link href={`/game/${a.package.game.slug}?pkg=${a.package.id}`}><strong>{a.package.name}</strong></Link>
                  <br />
                  <span className="muted">
                    {a.package.game.name} · Giá lúc đặt: {fmtMoney(a.baselineCents, prefs.cur, prefs.lang)} · Giá hiện tại: {fmtMoney(a.package.priceCents, prefs.cur, prefs.lang)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {a.active
                    ? <span className="crt-badge green">Đang theo dõi</span>
                    : <span className="crt-badge gray">{a.triggeredAt ? `Đã báo ${a.triggeredAt.toLocaleDateString("vi-VN")}` : "Đã tắt"}</span>}
                  {!a.active && (
                    <form action={reactivatePriceAlertAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="btn btn-outline btn-sm" type="submit">Bật lại</button>
                    </form>
                  )}
                  <form action={deletePriceAlertAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn btn-outline btn-sm" type="submit">Xoá</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
