"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      style={{ marginLeft: "auto", flexShrink: 0 }}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { }
      }}
    >
      {done ? "Đã chép" : "Sao chép"}
    </button>
  );
}
