"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SortSelect({ options, current }: { options: { value: string; label: string }[]; current: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (v: string) => {
    const p = new URLSearchParams(sp.toString());
    p.delete("page");
    if (v === "popular") p.delete("sort"); else p.set("sort", v);
    setOpen(false);
    const qs = p.toString();
    router.push("/games" + (qs ? `?${qs}` : ""));
  };

  const cur = options.find((o) => o.value === current) ?? options[0];
  return (
    <div className="sortdd" ref={ref}>
      <button type="button" className="sortdd-btn" aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen(!open)}>
        <span>{cur.label}</span>
        <svg className={open ? "open" : ""} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="sortdd-panel" role="listbox">
          {options.map((o) => (
            <button key={o.value} type="button" role="option" aria-selected={o.value === current} className={o.value === current ? "sortdd-opt on" : "sortdd-opt"} onClick={() => pick(o.value)}>
              <span>{o.label}</span>
              {o.value === current && (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
