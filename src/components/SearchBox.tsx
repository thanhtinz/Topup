"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Hit = { slug: string; name: string; cover: string; meta: string };

export default function SearchBox({ placeholder }: { placeholder?: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q.trim()) { setHits([]); setOpen(false); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) { setHits(await res.json()); setOpen(true); }
    }, 180);
  }, [q]);

  return (
    <div className={`search-wrap${open && hits.length ? " open" : ""}`}>
      <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>
        <input type="search" placeholder={placeholder ?? "Tìm game — ví dụ: Free Fire…"} aria-label="Tìm game" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => hits.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      </form>
      <div className="search-results" role="listbox" aria-label="Kết quả tìm kiếm">
        {hits.map((h) => (
          <Link className="sr-row" href={`/game/${h.slug}`} key={h.slug} role="option">
            <span className="sr-thumb"><img src={h.cover} alt="" referrerPolicy="no-referrer" /></span>
            <span className="sr-info">
              <span className="sr-name">{h.name}</span>
              <span className="sr-meta">{h.meta}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
