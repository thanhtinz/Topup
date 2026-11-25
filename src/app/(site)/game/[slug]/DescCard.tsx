"use client";
import { useState } from "react";

export default function DescCard({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="desc-card">
      <button type="button" className="desc-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <h2>{title}</h2>
        <svg className={open ? "desc-chev open" : "desc-chev"} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && <div className="desc-body">{text}</div>}
    </section>
  );
}
