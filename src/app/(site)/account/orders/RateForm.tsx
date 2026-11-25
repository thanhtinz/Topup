"use client";
import { useState } from "react";
import { reviewOrderAction } from "../../../actions";

export default function RateForm({ orderId, perReview }: { orderId: number; perReview: number }) {
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(5);
  if (!open) {
    return (
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>
        Đánh giá +{perReview}đ
      </button>
    );
  }
  return (
    <form action={reviewOrderAction} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 230 }}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="stars" value={stars} />
      <div style={{ display: "flex", gap: 3 }} role="radiogroup" aria-label="Số sao">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setStars(n)} aria-label={`${n} sao`} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 2, color: n <= stars ? "#E8A33D" : "#D8D2C4" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8L12 3z" /></svg>
          </button>
        ))}
      </div>
      <input name="comment" placeholder="Nhận xét (không bắt buộc)" maxLength={500} style={{ height: 36, border: "1px solid var(--line)", borderRadius: 9, padding: "0 10px", fontFamily: "inherit", fontSize: 13.5 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary btn-sm" type="submit">Gửi đánh giá</button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(false)}>Huỷ</button>
      </div>
    </form>
  );
}
