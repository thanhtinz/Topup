"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";

export type OrderCardData = {
  code: string;
  statusLabel: string;
  statusStyle: { background: string; color: string };
  total: string;
  cover: string;
  gameName: string;
  pkgLine: string;
  qty: number;
  datetime: string;
  fields: Array<[string, string]>;
  savings: Array<[string, string]>;
  note?: string | null;
};

export default function OrderCard({ data, reviewSlot }: { data: OrderCardData; reviewSlot?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="bsx-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {data.code.startsWith("#") ? (
          <b style={{ fontSize: 15.5, color: "#0F172A", letterSpacing: ".01em" }}>{data.code}</b>
        ) : (
          <Link href={`/account/orders/${data.code}`} title="Theo dõi tiến trình đơn hàng" style={{ fontSize: 15.5, color: "#0B63E5", letterSpacing: ".01em", fontWeight: 700 }}>{data.code}</Link>
        )}
        <span style={{ borderRadius: 999, padding: "4px 12px", fontSize: 12.5, fontWeight: 700, ...data.statusStyle }}>{data.statusLabel}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 19, fontWeight: 800, color: "#0F172A" }}>{data.total}</div>
      <div style={{ borderTop: "1px solid #EEF2F6", marginTop: 14, paddingTop: 14, display: "flex", gap: 13, alignItems: "center" }}>
        {data.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.cover} alt="" width={56} height={56} referrerPolicy="no-referrer" style={{ borderRadius: 12, objectFit: "cover", flex: "none" }} />
        ) : (
          <span style={{ width: 56, height: 56, borderRadius: 12, background: "#EAF3FE", flex: "none" }} />
        )}
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 16, color: "#0F172A", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.gameName}</b>
          <div className="muted" style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.pkgLine}</div>
          <div className="muted" style={{ fontSize: 13.5 }}>Số lượng: {data.qty}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 10 }}>
        <span className="muted" style={{ fontSize: 13.5 }}>{data.datetime}</span>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          style={{ background: "#0F172A", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          {open ? "Thu gọn" : "Chi tiết"}
        </button>
      </div>
      {open && (
        <div style={{ borderTop: "1px solid #EEF2F6", marginTop: 14, paddingTop: 12, display: "grid", gap: 6, fontSize: 13.5 }}>
          {data.fields.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
              <span className="muted">{k}</span>
              <b style={{ color: "#0F172A", textAlign: "right", wordBreak: "break-all" }}>{v}</b>
            </div>
          ))}
          {data.savings.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
              <span className="muted">{k}</span>
              <b style={{ color: "#0B63E5" }}>{v}</b>
            </div>
          ))}
          {data.note && <p className="muted" style={{ margin: "4px 0 0" }}>Ghi chú: {data.note}</p>}
          {reviewSlot}
        </div>
      )}
    </article>
  );
}
