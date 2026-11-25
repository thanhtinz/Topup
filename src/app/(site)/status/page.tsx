import { getSystemStatus, STATE_LABEL, type CompState } from "@/lib/status";

export const dynamic = "force-dynamic";

export const metadata = { title: "Trạng thái hệ thống — BNTGame", description: "Tình trạng hoạt động của website, API đấu nối cho khách hàng và cổng nạp BNTGame theo thời gian thực." };

const DOT: Record<CompState, string> = { operational: "status-ok", degraded: "status-degraded", down: "status-down", off: "status-off" };

export default async function StatusPage() {
  const { components, incident, overall } = await getSystemStatus();
  return (
    <main className="bsx">
      <div className="container" style={{ maxWidth: 760, paddingTop: 28, paddingBottom: 52 }}>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>Trạng thái hệ thống</h1>
        <p className="muted" style={{ marginBottom: 20 }}>Cập nhật lúc {new Date().toLocaleString("vi-VN")} — trang tự tính từ tín hiệu vận hành thật của hệ thống.</p>

        <div className="crt-card" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <span className={`status-dot ${DOT[overall]}`} />
          <strong style={{ fontSize: 16 }}>{overall === "operational" ? "Mọi hệ thống hoạt động bình thường" : STATE_LABEL[overall]}</strong>
        </div>

        {incident && (
          <div className="crt-card" style={{ marginBottom: 14, borderColor: "#F3C2C0", background: "#FFF8F7" }}>
            <strong style={{ color: "#B3261E", display: "block", marginBottom: 4 }}>{incident.title}</strong>
            {incident.body && <p style={{ fontSize: 14.5, lineHeight: 1.6 }}>{incident.body}</p>}
          </div>
        )}

        <div className="crt-card">
          {components.map((c, i) => (
            <div key={c.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "13px 0", borderTop: i === 0 ? "none" : "1px solid #EEF3F9", flexWrap: "wrap" }}>
              <div>
                <strong style={{ fontSize: 15 }}>{c.name}</strong>
                <br />
                <span className="muted" style={{ fontSize: 13.5 }}>{c.detail}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                <span className={`status-dot ${DOT[c.state]}`} />
                {STATE_LABEL[c.state]}
              </span>
            </div>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 14, fontSize: 13.5 }}>
          Gặp sự cố với đơn hàng của bạn? Vào mục Đơn hàng trong tài khoản để theo dõi tiến trình, hoặc liên hệ kênh hỗ trợ.
        </p>
      </div>
    </main>
  );
}
