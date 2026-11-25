"use client";
import { useEffect, useState } from "react";

export default function Toast({ msg, err }: { msg?: string; err?: string }) {
  const [show, setShow] = useState(Boolean(msg || err));
  useEffect(() => {
    setShow(Boolean(msg || err));
    if (!msg && !err) return;
    const t = setTimeout(() => setShow(false), 4500);
    return () => clearTimeout(t);
  }, [msg, err]);
  if (!show || (!msg && !err)) return null;
  return (
    <div
      role="status"
      onClick={() => setShow(false)}
      style={{
        position: "fixed", top: 74, right: 18, zIndex: 200, maxWidth: 380, cursor: "pointer",
        background: err ? "#B3261E" : "#0B7A55", color: "#fff", fontWeight: 600, fontSize: 14.5,
        padding: "12px 16px", borderRadius: 12, boxShadow: "0 12px 32px rgba(16,24,40,.35)",
      }}
    >
      {err || msg}
    </div>
  );
}
