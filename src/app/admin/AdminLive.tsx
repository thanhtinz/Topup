"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type AdminCounts = {
  deposits: number;
  tickets: number;
  orders: number;
  creatorApps: number;
  creatorPayouts: number;
  partnerApps: number;
  partnerPayments: number;
};

const QUEUES: Array<{ key: keyof AdminCounts; label: string; href: string }> = [
  { key: "deposits", label: "Lệnh nạp chờ duyệt", href: "/admin/deposits" },
  { key: "orders", label: "Đơn đang xử lý", href: "/admin/orders" },
  { key: "creatorPayouts", label: "Yêu cầu rút tiền Affiliate", href: "/admin/partnership/affiliate/payouts" },
  { key: "partnerApps", label: "Hồ sơ hợp tác Partnership mới", href: "/admin/partnership/applications" },
  { key: "partnerPayments", label: "Khoản chi Partnership chờ duyệt", href: "/admin/partnership/payments" },
  { key: "tickets", label: "Ticket hỗ trợ đang mở", href: "/admin/tickets" },
];

type Toast = { id: number; text: string; href: string };

function patchBadges(counts: AdminCounts) {
  const derived: Record<string, number> = {
    ...counts,
    creatorTotal: counts.creatorApps + counts.creatorPayouts,
    partnerTotal: counts.partnerApps + counts.partnerPayments,
  };
  document.querySelectorAll<HTMLElement>("[data-count-key]").forEach((el) => {
    const v = derived[el.dataset.countKey ?? ""];
    if (typeof v !== "number") return;
    el.textContent = String(v);
    el.style.display = v > 0 ? "" : "none";
  });
}

export default function AdminLive({ initial }: { initial: AdminCounts }) {
  const [counts, setCounts] = useState<AdminCounts>(initial);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const prev = useRef<AdminCounts>(initial);
  const baseTitle = useRef<string>("");
  const toastId = useRef(0);

  const total = counts.deposits + counts.tickets + counts.orders + counts.creatorApps + counts.creatorPayouts + counts.partnerApps + counts.partnerPayments;

  const applyCounts = useCallback((next: AdminCounts, announce: boolean) => {
    if (announce) {
      const fresh: Toast[] = [];
      for (const q of QUEUES) {
        const delta = next[q.key] - prev.current[q.key];
        if (delta > 0) fresh.push({ id: ++toastId.current, text: `Có ${delta} mục mới: ${q.label.toLowerCase()}`, href: q.href });
      }
      if (fresh.length) {
        setToasts((t) => [...t, ...fresh].slice(-4));
        fresh.forEach((f) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== f.id)), 10000));
      }
    }
    prev.current = next;
    setCounts(next);
    patchBadges(next);
  }, []);

  useEffect(() => {
    baseTitle.current = document.title.replace(/^\(\d+\)\s*/, "");
    patchBadges(initial);
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch("/api/admin/counts", { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as AdminCounts;
        if (!stopped) applyCounts(data, true);
      } catch { /* mạng chập chờn: bỏ qua lượt này */ }
    };
    const iv = setInterval(tick, 25000);
    const onVis = () => { if (document.visibilityState === "visible") void tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stopped = true; clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = total > 0 ? `(${total}) ${baseTitle.current || "Admin"}` : baseTitle.current;
    if (t) document.title = t;
  }, [total]);

  return (
    <>
      <div className="live-wrap">
        <button type="button" className="icon-btn" aria-label="Thông báo quản trị" onClick={() => setOpen((v) => !v)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9Z" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></svg>
          {total > 0 && <span className="live-badge">{total}</span>}
        </button>
        {open && (
          <>
            <div className="live-backdrop" onClick={() => setOpen(false)} />
            <div className="live-panel">
              <p className="live-panel-title">Cần xử lý</p>
              {QUEUES.map((q) => (
                <Link key={q.key} href={q.href} className="live-row" onClick={() => setOpen(false)}>
                  <span>{q.label}</span>
                  <span className={`live-num${counts[q.key] > 0 ? " on" : ""}`}>{counts[q.key]}</span>
                </Link>
              ))}
              <p className="live-note">Số liệu tự cập nhật mỗi 25 giây.</p>
            </div>
          </>
        )}
      </div>
      {toasts.length > 0 && (
        <div className="live-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="live-toast">
              <Link href={t.href} onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>{t.text}</Link>
              <button type="button" aria-label="Đóng" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>×</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
