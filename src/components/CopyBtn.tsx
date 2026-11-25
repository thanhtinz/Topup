"use client";
import { useState } from "react";

export default function CopyBtn({ text, label = "Chép mã" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-primary btn-sm"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { }
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? "Đã chép" : label}
    </button>
  );
}
