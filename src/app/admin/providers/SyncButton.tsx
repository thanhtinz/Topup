"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SyncState } from "@/lib/sync";

export default function SyncButton({ code, initial, label, btnClass }: { code: string; initial: SyncState; label?: string; btnClass?: string }) {
  const router = useRouter();
  const [st, setSt] = useState<SyncState>(initial);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshed = useRef(false);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/sync/${code}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as SyncState;
      setSt(j);
      if (j.status !== "running") {
        if (timer.current) clearInterval(timer.current);
        if (j.status === "done" && !refreshed.current) {
          refreshed.current = true;
          setTimeout(() => router.refresh(), 1200);
        }
      }
    } catch { /* mạng chớp — lần hỏi sau thử lại */ }
  }, [code, router]);

  useEffect(() => {
    if (st.status === "running") {
      timer.current = setInterval(poll, 1500);
      const t0 = st.startedAt || Date.now();
      const tick = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - t0) / 1000))), 500);
      return () => { if (timer.current) clearInterval(timer.current); clearInterval(tick); };
    }
  }, [st.status, st.startedAt, poll]);

  const start = async () => {
    refreshed.current = false;
    setSt((p) => ({ ...p, status: "running", phase: "Đang bắt đầu...", message: "", startedAt: Date.now(), finishedAt: 0 }));
    try {
      const r = await fetch(`/api/admin/sync/${code}`, { method: "POST" });
      if (r.ok) setSt((await r.json()) as SyncState);
    } catch { /* poll sẽ tự cập nhật */ }
  };

  const running = st.status === "running";
  const pct = st.total > 0 ? Math.min(100, Math.round((st.done / st.total) * 100)) : 0;

  return (
    <div>
      <button type="button" className={btnClass ?? "btn btn-primary"} onClick={start} disabled={running}>
        {running ? "Đang đồng bộ..." : (label ?? "Đồng bộ catalog ngay")}
      </button>
      {running && (
        <div className="sync-prog" role="status">
          <div className="sync-phase">
            <span>{st.phase || "Đang chạy..."}</span>
            <span className="sync-count">
              {st.total > 0 ? `${st.done.toLocaleString("vi-VN")} / ${st.total.toLocaleString("vi-VN")} · ` : ""}
              {elapsed}s
            </span>
          </div>
          <div className="sync-bar">
            {st.total > 0
              ? <div className="sync-fill" style={{ width: `${pct}%` }} />
              : <div className="sync-fill sync-fill--indet" />}
          </div>
        </div>
      )}
      {st.status === "done" && st.message && <p className="sync-done">{st.message}</p>}
      {st.status === "error" && st.message && <p className="sync-err">{st.message}</p>}
    </div>
  );
}
