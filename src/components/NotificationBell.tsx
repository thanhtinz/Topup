"use client";
import { useState } from "react";
import Link from "next/link";
import { markNotificationsReadAction } from "@/app/actions";

export type NotifItem = {
  id: number;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  time: string;
};

const KIND_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  ORDER: { bg: "#EAF3FE", fg: "#0B63E5", label: "✓" },
  DEPOSIT: { bg: "#EAF3FE", fg: "#0B63E5", label: "+" },
  AFFILIATE: { bg: "#EAF3FE", fg: "#0A45B4", label: "%" },
  REFUND: { bg: "#FEF3C7", fg: "#92400E", label: "↩" },
  SYSTEM: { bg: "#F1F5F9", fg: "#475569", label: "!" },
};

export default function NotificationBell({ unread, items }: { unread: number; items: NotifItem[] }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(unread);
  const [list, setList] = useState(items);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && count > 0) {
      setCount(0);
      setList((prev) => prev.map((n) => ({ ...n, read: true })));
      void markNotificationsReadAction();
    }
  };

  return (
    <div className="notif-wrap">
      <button type="button" className="notif-btn" aria-label="Thông báo" aria-expanded={open} onClick={toggle}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {count > 0 && <span className="notif-badge">{count > 9 ? "9+" : count}</span>}
      </button>
      {open && (
        <>
          <button type="button" aria-hidden="true" tabIndex={-1} className="prefs-veil" onClick={() => setOpen(false)} />
          <div className="notif-card" role="menu" aria-label="Thông báo">
            <div className="notif-head">Thông báo</div>
            {list.length ? (
              <div className="notif-list">
                {list.map((n) => {
                  const st = KIND_STYLE[n.kind] ?? KIND_STYLE.SYSTEM;
                  const inner = (
                    <>
                      <span className="notif-ico" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                      <span className="notif-main">
                        <span className="notif-title">{n.title}</span>
                        <span className="notif-body">{n.body}</span>
                        <span className="notif-time">{n.time}</span>
                      </span>
                      {!n.read && <span className="notif-dot" />}
                    </>
                  );
                  return n.link ? (
                    <Link key={n.id} href={n.link} className="notif-row" onClick={() => setOpen(false)}>{inner}</Link>
                  ) : (
                    <div key={n.id} className="notif-row">{inner}</div>
                  );
                })}
              </div>
            ) : (
              <p className="notif-empty">Chưa có thông báo nào</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
