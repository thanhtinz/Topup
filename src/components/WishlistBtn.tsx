"use client";
import { useState, useTransition } from "react";
import { toggleWishlistAction } from "@/app/(site)/account/engage-actions";

export default function WishlistBtn({ gameId, initial, loggedIn }: { gameId: number; initial: boolean; loggedIn: boolean }) {
  const [wished, setWished] = useState(initial);
  const [pending, start] = useTransition();
  const heart = (filled: boolean) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
  );
  if (!loggedIn) {
    return (
      <a className="wish-btn" href="/login" aria-label="Đăng nhập để thêm yêu thích">
        {heart(false)}
        <span className="wish-label">Yêu thích</span>
      </a>
    );
  }
  return (
    <button
      type="button"
      className={`wish-btn ${wished ? "on" : ""}`}
      disabled={pending}
      aria-pressed={wished}
      aria-label={wished ? "Bỏ yêu thích game này" : "Thêm game vào yêu thích"}
      onClick={() => start(async () => { const r = await toggleWishlistAction({ gameId }); if (r.ok) setWished(r.wished); })}
    >
      {heart(wished)}
      <span className="wish-label">{wished ? "Đã yêu thích" : "Yêu thích"}</span>
    </button>
  );
}
