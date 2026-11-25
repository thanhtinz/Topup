import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import { adminLoginAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const inp: React.CSSProperties = {
  width: "100%", borderRadius: 12, border: "1px solid #D8DFEA", padding: "12px 14px",
  fontSize: 15, boxSizing: "border-box", fontFamily: "inherit", background: "#fff",
};
const lbl: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#3D4756", margin: "14px 0 6px" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const { err } = await searchParams;
  const user = await getCurrentUser();
  if (user && (user.role === "ADMIN" || user.role === "STAFF")) redirect("/admin");
  const s = await getSettings().catch(() => ({ site_name: "BNT Game" } as Record<string, string>));
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(160deg,#ECFDF5 0%,#F6F8FA 55%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 400, background: "#fff", border: "1px solid #E4E9F0", borderRadius: 20, padding: "30px 28px", boxShadow: "0 18px 50px rgba(16,24,40,.08)", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: "#059669", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 19 }}>{(s.site_name || "B").charAt(0).toUpperCase()}</span>
          <b style={{ fontSize: 19 }}>{s.site_name}</b>
          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#047857", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "4px 8px", borderRadius: 999 }}>ADMIN</span>
        </div>
        <h1 style={{ fontSize: 22, margin: "14px 0 8px" }}>Đăng nhập quản trị</h1>
        <p style={{ color: "#5B6675", fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>
          Khu vực chỉ dành cho quản trị viên. Dùng tài khoản quản trị đã tạo ở bước thiết lập lần đầu.
        </p>
        {err && <div className="form-err" style={{ marginTop: 16 }}>{err}</div>}
        <form action={adminLoginAction}>
          <label style={lbl}>Email quản trị</label>
          <input name="email" type="email" required style={inp} placeholder="admin@..." autoComplete="email" />
          <label style={lbl}>Mật khẩu</label>
          <input name="password" type="password" required style={inp} autoComplete="current-password" />
          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 22, padding: "13px 0", fontSize: 15.5 }}>
            Đăng nhập
          </button>
        </form>
      </div>
    </main>
  );
}
