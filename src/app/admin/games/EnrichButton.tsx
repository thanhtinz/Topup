"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type State = {
  status: "idle" | "running" | "done" | "error";
  phase: string; done: number; total: number; message: string; startedAt: number;
};

export default function EnrichButton({ initial }: { initial: State }) {
  const router = useRouter();
  const [st, setSt] = useState<State>(initial);
  const [secs, setSecs] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };

  const poll = () => {
    stop();
    timer.current = setInterval(async () => {
      try {
        const r = await fetch("/api/admin/enrich");
        if (!r.ok) { stop(); return; }
        const s = (await r.json()) as State;
        setSt(s);
        if (s.status !== "running") { stop(); if (s.status === "done") setTimeout(() => router.refresh(), 1200); }
      } catch { stop(); }
    }, 1500);
  };

  useEffect(() => {
    if (initial.status === "running") poll();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (st.status !== "running") { setSecs(0); return; }
    const t = setInterval(() => setSecs(Math.floor((Date.now() - (st.startedAt || Date.now())) / 1000)), 500);
    return () => clearInterval(t);
  }, [st.status, st.startedAt]);

  const start = async () => {
    const r = await fetch("/api/admin/enrich", { method: "POST" });
    if (!r.ok) return;
    setSt((await r.json()) as State);
    poll();
  };

  const pct = st.total > 0 ? Math.min(100, Math.round((st.done / st.total) * 100)) : 0;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      <button className="btn btn-outline btn-sm" type="button" onClick={start} disabled={st.status === "running"}>
        {st.status === "running" ? "Đang bổ sung..." : "Tự điền ảnh & thể loại"}
      </button>
      {st.status === "running" && (
        <span className="sync-prog" style={{ minWidth: 240 }}>
          <span className="sync-phase"><span>{st.phase}</span><span className="sync-count">{st.total > 0 ? `${st.done}/${st.total} · ` : ""}{secs}s</span></span>
          <span className="sync-bar">{st.total > 0 ? <span className="sync-fill" style={{ width: `${pct}%` }} /> : <span className="sync-fill sync-fill--indet" />}</span>
        </span>
      )}
      {st.status === "done" && st.message && <span className="sync-done">{st.message}</span>}
      {st.status === "error" && st.message && <span className="sync-err">{st.message}</span>}
    </span>
  );
}
