import { openSecret } from "@/lib/gateways";
import { testGatewayAction } from "../actions";

export const secretHint = (v: string | undefined) => (openSecret(v) ? "Đã cấu hình — để trống nếu giữ nguyên" : "Chưa cấu hình");

export function ToggleRow({ name, label, desc, checked }: { name: string; label: string; desc: string; checked: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", border: "1px solid var(--aline)", borderRadius: 12, background: "#FAFBFE", marginBottom: 16 }}>
      <input type="checkbox" name={name} value="1" defaultChecked={checked} style={{ width: 20, height: 20, accentColor: "var(--aaccent)" }} />
      <div>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{label}</div>
        <div className="muted" style={{ fontSize: 13 }}>{desc}</div>
      </div>
    </div>
  );
}

export function GatewayActions() {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
      <button className="btn btn-primary" type="submit">Lưu cấu hình</button>
      <button className="btn btn-outline" type="submit" formAction={testGatewayAction}>Kiểm tra kết nối</button>
    </div>
  );
}
