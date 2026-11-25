"use client";
import { useState } from "react";
import PrioritySelect from "../PrioritySelect";

const selStyle: React.CSSProperties = { height: 36, borderRadius: 9, border: "1px solid #D8DFEA", fontFamily: "inherit", fontSize: 14, padding: "0 8px", background: "#fff" };

export default function CompareControls({ gameId, initialPriority, initialApproved }: { gameId: number; initialPriority: string; initialApproved: boolean }) {
  const [approved, setApproved] = useState(initialApproved);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const toggle = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/game-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, kind: approved ? "unapprove" : "approve" }),
      });
      const j = (await r.json().catch(() => null)) as { compareApproved?: boolean } | null;
      if (!r.ok || !j || typeof j.compareApproved !== "boolean") throw new Error("bad");
      setApproved(j.compareApproved);
    } catch {
      setErr("Lỗi, thử lại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <td>
        <PrioritySelect gameId={gameId} initial={initialPriority} style={selStyle} />
      </td>
      <td>
        {approved
          ? <span className="badge green">Đã duyệt · Đang hiện</span>
          : <span className="badge amber">Chờ duyệt · Đang ẩn</span>}
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <button className={`btn btn-sm ${approved ? "btn-outline" : "btn-accent"}`} type="button" onClick={toggle} disabled={busy}>
            {busy ? "Đang lưu…" : approved ? "Bỏ duyệt" : "Duyệt"}
          </button>
          {err && <span style={{ fontSize: 12.5, fontWeight: 700, color: "#B3261E" }}>{err}</span>}
        </div>
      </td>
    </>
  );
}
