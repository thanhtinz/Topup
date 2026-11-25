"use client";
import { useState } from "react";
import { reviewOrderAction } from "../../../actions";

export default function GameReviewForm({ orderId, orderCode, perReview, back, lang }: { orderId: number; orderCode: string; perReview: number; back: string; lang: string }) {
  const [stars, setStars] = useState(5);
  const en = lang === "en";
  return (
    <form action={reviewOrderAction} className="rv-form">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="stars" value={stars} />
      <input type="hidden" name="back" value={back} />
      <p className="rv-form-title">
        {en ? "Rate your order" : "Đánh giá đơn"} {orderCode}
        {perReview > 0 && <span className="rv-form-bonus">+{perReview} {en ? "points" : "điểm"}</span>}
      </p>
      <div style={{ display: "flex", gap: 3 }} role="radiogroup" aria-label={en ? "Stars" : "Số sao"}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setStars(n)} aria-label={`${n} sao`} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 2, color: n <= stars ? "#E8A33D" : "#D8D2C4" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8L12 3z" /></svg>
          </button>
        ))}
      </div>
      <input name="comment" placeholder={en ? "Your review (optional)" : "Nhận xét của bạn (không bắt buộc)"} maxLength={500} className="rv-input" />
      <div>
        <button className="btn btn-primary" type="submit">{en ? "Submit review" : "Gửi đánh giá"}</button>
      </div>
    </form>
  );
}
