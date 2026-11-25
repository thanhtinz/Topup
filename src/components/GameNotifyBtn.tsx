"use client";
import { useState, useTransition } from "react";
import { toggleGameNotifyAction } from "@/app/(site)/account/engage-actions";

export default function GameNotifyBtn({ gameId, initial, loggedIn }: { gameId: number; initial: boolean; loggedIn: boolean }) {
  const [subbed, setSubbed] = useState(initial);
  const [pending, start] = useTransition();
  const bell = (filled: boolean) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
  );
  if (!loggedIn) {
    return (
      <a className="wish-btn" href="/login" aria-label="Đăng nhập để nhận thông báo game này">
        {bell(false)}
        <span className="wish-label">Nhận thông báo</span>
      </a>
    );
  }
  return (
    <button
      type="button"
      className={`wish-btn ${subbed ? "on" : ""}`}
      disabled={pending}
      aria-pressed={subbed}
      aria-label={subbed ? "Tắt nhận thông báo game này" : "Nhận thông báo khi game này giảm giá"}
      title="Nhận thông báo khi bất kỳ gói nào của game giảm giá"
      onClick={() => start(async () => { const r = await toggleGameNotifyAction({ gameId }); if (r.ok) setSubbed(r.subbed); })}
    >
      {bell(subbed)}
      <span className="wish-label">{subbed ? "Đã bật thông báo" : "Nhận thông báo"}</span>
    </button>
  );
}
