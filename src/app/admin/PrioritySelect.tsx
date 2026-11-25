"use client";
import { useRef, useState } from "react";

const MODES = [
  { v: "ERIS", label: "Ưu tiên Eris" },
  { v: "FZR", label: "Ưu tiên FZR" },
  { v: "ERIS_ONLY", label: "Chỉ Eris" },
  { v: "FZR_ONLY", label: "Chỉ FZR" },
];

export default function PrioritySelect({ gameId, initial, style }: { gameId: number; initial: string; style?: React.CSSProperties }) {
  const [value, setValue] = useState(initial);
  const saved = useRef(initial);
  const [note, setNote] = useState<"" | "saving" | "saved" | "error">("");
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    setValue(next);
    setNote("saving");
    try {
      const r = await fetch("/api/admin/game-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, priority: next }),
      });
      if (!r.ok) throw new Error("bad");
      saved.current = next;
      setNote("saved");
      if (fade.current) clearTimeout(fade.current);
      fade.current = setTimeout(() => setNote(""), 2200);
    } catch {
      setValue(saved.current);
      setNote("error");
    }
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <select value={value} onChange={onChange} style={style} aria-label="Chế độ nguồn">
        {MODES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
      </select>
      {note === "saving" && <span className="muted" style={{ fontSize: 12.5 }}>Đang lưu…</span>}
      {note === "saved" && <span style={{ fontSize: 12.5, fontWeight: 700, color: "#157347" }}>Đã lưu</span>}
      {note === "error" && <span style={{ fontSize: 12.5, fontWeight: 700, color: "#B3261E" }}>Lưu lỗi, thử lại</span>}
    </span>
  );
}
