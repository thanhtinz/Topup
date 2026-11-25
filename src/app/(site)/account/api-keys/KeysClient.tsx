"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type KeyRow = { id: number; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

export default function KeysClient({ initial }: { initial: KeyRow[] }) {
  const router = useRouter();
  const [keys, setKeys] = useState(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  async function create() {
    setBusy(true); setErr(""); setFreshKey(null); setCopied(false);
    try {
      const res = await fetch("/api/account/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await res.json();
      if (!res.ok || !data.ok) { setErr(data.message ?? "Tạo khoá thất bại"); return; }
      setFreshKey(data.key as string);
      setKeys((prev) => [{ id: data.id, name, prefix: data.prefix, createdAt: new Date().toISOString(), lastUsedAt: null, revokedAt: null }, ...prev]);
      setName("");
      router.refresh();
    } catch { setErr("Tạo khoá thất bại — thử lại sau"); }
    finally { setBusy(false); }
  }

  async function revoke(id: number) {
    if (!window.confirm("Thu hồi khoá này? Mọi hệ thống đang dùng khoá này sẽ mất kết nối ngay.")) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/account/keys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await res.json();
      if (!res.ok || !data.ok) { setErr("Thu hồi thất bại"); return; }
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)));
      router.refresh();
    } catch { setErr("Thu hồi thất bại — thử lại sau"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="crt-card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 6 }}>Tạo khoá mới</h3>
        <p className="muted" style={{ marginBottom: 12 }}>Đặt tên để nhớ khoá dùng cho hệ thống nào (vd: Web đại lý, Bot Telegram). Tối đa 10 khoá đang hoạt động.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "stretch" }}>
          <div className="field" style={{ flex: "1 1 240px", margin: 0 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên khoá (không bắt buộc)" maxLength={60} />
          </div>
          <button type="button" className="btn btn-primary" onClick={create} disabled={busy}>{busy ? "Đang tạo…" : "Tạo API key"}</button>
        </div>
        {err && <p className="form-err" style={{ marginTop: 10 }}>{err}</p>}
        {freshKey && (
          <div style={{ marginTop: 14, background: "#FFF7E8", border: "1px solid #F2D492", borderRadius: 12, padding: "12px 14px" }}>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>Khoá mới của bạn — sao chép ngay, khoá chỉ hiển thị lần này:</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <code style={{ background: "#fff", border: "1px solid #EAD9AC", borderRadius: 8, padding: "8px 10px", fontSize: 14, wordBreak: "break-all" }}>{freshKey}</code>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { navigator.clipboard?.writeText(freshKey).catch(() => null); setCopied(true); }}>{copied ? "Đã sao chép" : "Sao chép"}</button>
            </div>
            <p className="muted" style={{ marginTop: 8 }}>Giữ khoá bí mật như mật khẩu — ai có khoá đều đặt đơn và trừ tiền từ ví của bạn được.</p>
          </div>
        )}
      </div>

      <div className="crt-card">
        <h3 style={{ marginBottom: 10 }}>Khoá của bạn ({keys.length})</h3>
        {keys.length === 0 ? <p className="muted">Chưa có khoá nào. Tạo khoá đầu tiên để bắt đầu đấu nối.</p> : keys.map((k) => (
          <div key={k.id} className="key-row">
            <div className="key-main">
              <div className="key-name">
                <strong>{k.name || "Khoá không tên"}</strong>
                {k.revokedAt ? <span className="crt-badge red">Đã thu hồi</span> : <span className="crt-badge green">Đang hoạt động</span>}
              </div>
              <code className="key-prefix">{k.prefix}••••••••••</code>
              <p className="key-meta">
                Tạo {new Date(k.createdAt).toLocaleDateString("vi-VN")}
                {k.lastUsedAt
                  ? ` · Dùng gần nhất ${new Date(k.lastUsedAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}`
                  : " · Chưa dùng lần nào"}
              </p>
            </div>
            {!k.revokedAt && <button type="button" className="btn btn-danger btn-sm" onClick={() => revoke(k.id)} disabled={busy}>Thu hồi</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
