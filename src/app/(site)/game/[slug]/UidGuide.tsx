"use client";
import { useEffect, useState } from "react";
import type { GuideStep } from "@/lib/guide";

export default function UidGuide({ steps, label, closeLabel }: { steps: GuideStep[]; label: string; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open ]);
  if (!steps.length) return null;
  return (
    <>
      <button type="button" className="btn btn-outline btn-sm uid-guide-btn" onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M9.5 9.3A2.6 2.6 0 0 1 12 7.5c1.4 0 2.5 1 2.5 2.2 0 1.7-2.4 2-2.4 3.5" /><circle cx="12" cy="17" r="0.6" fill="currentColor" /></svg>
        {label}
      </button>
      {open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={label} onClick={() => setOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <b>{label}</b>
              <button type="button" className="modal-x" onClick={() => setOpen(false)} aria-label={closeLabel}>×</button>
            </div>
            <ol className="guide-steps">
              {steps.map((s, i) => (
                <li key={i}>
                  <span className="guide-num">{i + 1}</span>
                  <div>
                    <p>{s.text}</p>
                    {s.image && <img src={s.image} alt="" loading="lazy" />}
                  </div>
                </li>
              ))}
            </ol>
            <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={() => setOpen(false)}>{closeLabel}</button>
          </div>
        </div>
      )}
    </>
  );
}
