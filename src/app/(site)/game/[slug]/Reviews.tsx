import { toggleHelpfulAction } from "@/app/actions";
import { fmtMoney, type Cur } from "@/lib/moneyfmt";
import GameReviewForm from "./GameReviewForm";

export type ReviewRow = {
  id: number;
  stars: number;
  comment: string | null;
  helpfulCount: number;
  createdAt: Date;
  user: { name: string };
  order: { totalCents: number };
};

type Props = {
  slug: string;
  ratingAvg: number;
  ratingCount: number;
  reviewRows: ReviewRow[];
  starCounts: Record<number, number>;
  myOrder: { id: number; code: string } | null;
  myVotes: Set<number>;
  perReview: number;
  cur: Cur;
  lang: string;
};

export default function Reviews(p: Props) {
  const en = p.lang === "en";
  const locale = en ? "en-US" : "vi-VN";
  const relTime = (d: Date) => {
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return en ? "Just now" : "Vừa xong";
    if (mins < 60) return en ? `${mins}m ago` : `${mins} phút trước`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return en ? `${hrs}h ago` : `${hrs} giờ trước`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return en ? `${days}d ago` : `${days} ngày trước`;
    return d.toLocaleDateString(locale);
  };
  const starRow = (v: number, size = 15) => (
    <span style={{ display: "inline-flex", gap: 1, color: "#FF8A00" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24" fill={n <= Math.round(v) ? "currentColor" : "#E3DCCB"} stroke="none"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8L12 3z" /></svg>
      ))}
    </span>
  );
  const avg = p.ratingAvg > 0 ? p.ratingAvg : 5;
  return (
    <section className="rv" id="reviews">
      <h2 className="rv-h">{en ? "Reviews" : "Đánh giá"}</h2>
      <div className="rv-head">
        <div className="rv-sum">
          <b>{avg.toFixed(1)}</b>
          {starRow(avg, 26)}
          <span>{p.ratingCount.toLocaleString(locale)} {en ? "Reviews" : "Đánh giá"}</span>
        </div>
        <div className="rv-bars">
          {[5, 4, 3, 2, 1].map((n) => (
            <div key={n} className="rv-bar-row">
              <span className="rv-bar-lab">{n}<span className="rv-star">★</span></span>
              <span className="rv-track"><span className="rv-fill" style={{ width: `${p.ratingCount > 0 ? Math.round(((p.starCounts[n] ?? 0) / p.ratingCount) * 100) : 0}%` }} /></span>
              <span className="rv-bar-n">{p.ratingCount > 0 ? Math.round(((p.starCounts[n] ?? 0) / p.ratingCount) * 100) : 0}%</span>
            </div>
          ))}
        </div>
      </div>

      {p.myOrder ? (
        <GameReviewForm orderId={p.myOrder.id} orderCode={p.myOrder.code} perReview={p.perReview} back={`/game/${p.slug}`} lang={p.lang} />
      ) : (
        <p className="rv-note">{en ? "Only customers with a delivered order for this game can write a review." : "Chỉ khách đã mua và được giao thành công game này mới viết đánh giá được. Đánh giá của bạn sẽ hiện tại đây và ở trang Đơn hàng."}</p>
      )}

      <div className="rv-list">
        {p.reviewRows.map((r) => (
          <article key={r.id} className="rv-card">
            <div className="rv-card-top">
              <span className="rv-ava2" aria-hidden>{(r.user.name || "?").trim().charAt(0).toUpperCase()}</span>
              <div className="rv-card-id">
                <b>{r.user.name}</b>
                <span>{relTime(r.createdAt)}</span>
              </div>
              <div className="rv-score">
                <b>{r.stars.toFixed(1)}</b>
                <span className="rv-score-stars" aria-hidden>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <svg key={n} width="12" height="12" viewBox="0 0 24 24" fill={n <= r.stars ? "var(--accent)" : "#D5DCE8"} stroke="none"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8L12 3z" /></svg>
                  ))}
                </span>
              </div>
            </div>
            {r.comment && <p className="rv-card-comment">{r.comment}</p>}
            <div className="rv-card-foot">
              <form action={toggleHelpfulAction}>
                <input type="hidden" name="reviewId" value={r.id} />
                <input type="hidden" name="back" value={`/game/${p.slug}`} />
                <button type="submit" className={p.myVotes.has(r.id) ? "rv-help on" : "rv-help"} aria-pressed={p.myVotes.has(r.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></svg>
                  {en ? "Helpful" : "Hữu ích"}{r.helpfulCount > 0 ? ` (${r.helpfulCount})` : ""}
                </button>
              </form>
              <div className="rv-value">
                <span className="rv-value-lab">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M14 8H8" /><path d="M16 12H8" /><path d="M13 16H8" /></svg>
                  {en ? "Order value" : "Giá trị đơn"}
                </span>
                <b>{fmtMoney(r.order.totalCents, p.cur, p.lang)}</b>
              </div>
            </div>
          </article>
        ))}
        {!p.reviewRows.length && <p className="muted" style={{ padding: "10px 0 2px" }}>{en ? "No reviews yet." : "Chưa có đánh giá nào cho game này."}</p>}
      </div>
    </section>
  );
}
