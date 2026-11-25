"use client";

import { useState } from "react";
import type { PartnerCreator } from "@/lib/creator";

const GRADIENTS = [
  "linear-gradient(135deg,#0B63E5,#1FB6F2)",
  "linear-gradient(135deg,#7C3AED,#C084FC)",
  "linear-gradient(135deg,#EA580C,#F59E0B)",
  "linear-gradient(135deg,#059669,#34D399)",
  "linear-gradient(135deg,#DB2777,#F472B6)",
  "linear-gradient(135deg,#0F766E,#2DD4BF)",
  "linear-gradient(135deg,#B91C1C,#F87171)",
  "linear-gradient(135deg,#1D4ED8,#818CF8)",
];

const TIER_LABEL: Record<string, string> = { VERIFIED: "Đã xác thực", OFFICIAL: "Đối tác chính thức", CREATOR: "" };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function PartnerGrid({ creators }: { creators: PartnerCreator[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = creators.find((c) => c.id === selectedId) ?? null;
  return (
    <div>
      <div className="ptr-grid">
        {creators.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`ptr-tile${selectedId === c.id ? " on" : ""}`}
            onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
            aria-pressed={selectedId === c.id}
          >
            {c.avatarUrl
              ? <img className="ptr-ava" src={c.avatarUrl} alt={c.displayName} style={{ objectFit: "cover" }} />
              : <span className="ptr-ava" style={{ background: GRADIENTS[c.id % GRADIENTS.length] }}>{initials(c.displayName)}</span>}
            <span className="ptr-name">{c.displayName}</span>
            {TIER_LABEL[c.tier] && <span className="ptr-tier">{TIER_LABEL[c.tier]}</span>}
          </button>
        ))}
      </div>
      {selected && (
        <div className="ptr-panel">
          <div className="ptr-panel-head">
            <strong>{selected.displayName}</strong>
            <span>
              {[selected.levelName ? `Cấp ${selected.levelName}` : "", TIER_LABEL[selected.tier]].filter(Boolean).join(" · ")}
            </span>
          </div>
          <p style={{ margin: "0 0 12px" }}>
            <a href={`/creators/${selected.code}`} style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14.5 }}>Xem trang cá nhân →</a>
          </p>
          {selected.channels.length ? (
            <div className="ptr-channels">
              {selected.channels.map((ch, i) => {
                const label = `${ch.platform}${ch.channelName ? ` · ${ch.channelName}` : ""}`;
                return ch.url ? (
                  <a key={i} className="ptr-chip" href={ch.url.startsWith("http") ? ch.url : `https://${ch.url}`} target="_blank" rel="noreferrer">{label}</a>
                ) : (
                  <span key={i} className="ptr-chip">{label}</span>
                );
              })}
            </div>
          ) : (
            <p className="ptr-none">Affiliate chưa cập nhật liên kết kênh.</p>
          )}
        </div>
      )}
    </div>
  );
}
