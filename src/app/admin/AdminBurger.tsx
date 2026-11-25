"use client";
import { useEffect } from "react";

export default function AdminBurger() {
  const toggle = () => {
    const shell = document.querySelector(".admin-shell");
    if (!shell) return;
    if (window.innerWidth <= 900) shell.classList.toggle("nav-open");
    else shell.classList.toggle("side-collapsed");
  };
  const close = () => {
    document.querySelector(".admin-shell")?.classList.remove("nav-open");
  };

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const shell = document.querySelector(".admin-shell");
      if (!shell?.classList.contains("nav-open")) return;
      const t = e.target as HTMLElement;
      if (t.closest(".admin-side") || t.closest(".admin-burger")) return;
      shell.classList.remove("nav-open");
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest(".admin-side a")) {
        document.querySelector(".admin-shell")?.classList.remove("nav-open");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <>
      <button type="button" className="admin-burger" aria-label="Đóng/mở menu" onClick={toggle}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      <button type="button" className="admin-backdrop" aria-label="Đóng menu" onClick={close} />
    </>
  );
}
