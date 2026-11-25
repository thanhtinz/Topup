import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { hasAdmin } from "@/lib/setup";
import { setupAdminAction } from "./actions";

export const dynamic = "force-dynamic";

const inp: React.CSSProperties = {
  width: "100%", borderRadius: 12, border: "1px solid #D8DFEA", padding: "12px 14px",
  fontSize: 15, boxSizing: "border-box", fontFamily: "inherit", background: "#fff",
};
const lbl: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#3D4756", margin: "14px 0 6px" };

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const { err } = await searchParams;
  const s = await getSettings().catch(() => ({ site_name: "BNT Game" } as Record<string, string>));
  const done = await hasAdmin();
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(160deg,#ECFDF5 0%,#F6F8FA 55%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#fff", border: "1px solid #E4E9F0", borderRadius: 20, padding: "30px 28px", boxShadow: "0 18px 50px rgba(16,24,40,.08)", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: "#059669", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 19 }}>{(s.site_name || "B").charAt(0).toUpperCase()}</span>
          <b style={{ fontSize: 19 }}>{s.site_name}</b>
        </div>
        {done ? (
          <>
            <h1 style={{ fontSize: 22, margin: "14px 0 8px" }}>Đã thiết lập xong</h1>
            <p style={{ color: "#5B6675", fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>
              Hệ thống đã có tài khoản quản trị nên trang thiết lập lần đầu đã tự khoá. Đăng nhập bằng tài khoản quản trị để vào khu vực quản lý.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <Link href="/" className="btn btn-ghost" style={{ flex: 1, textAlign: "center" }}>Về trang chủ</Link>
              <Link href="/admin" className="btn btn-primary" style={{ flex: 1, textAlign: "center" }}>Vào quản trị</Link>
            </div>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 22, margin: "14px 0 8px" }}>Thiết lập lần đầu</h1>
            <p style={{ color: "#5B6675", fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>
              Tạo tài khoản quản trị viên đầu tiên cho website. Sau khi tạo xong, trang này sẽ tự khoá và tài khoản này dùng để đăng nhập khu vực quản trị.
            </p>
            {err && <div className="form-err" style={{ marginTop: 16 }}>{err}</div>}
            <form action={setupAdminAction}>
              <label style={lbl}>Họ tên quản trị viên</label>
              <input name="name" required style={inp} placeholder="Ví dụ: Admin" autoComplete="name" />
              <label style={lbl}>Email đăng nhập</label>
              <input name="email" type="email" required style={inp} placeholder="admin@..." autoComplete="email" />
              <label style={lbl}>Mật khẩu (ít nhất 10 ký tự)</label>
              <input name="password" type="password" required minLength={10} style={inp} autoComplete="new-password" />
              <label style={lbl}>Nhập lại mật khẩu</label>
              <input name="confirm" type="password" required minLength={10} style={inp} autoComplete="new-password" />
              <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 22, padding: "13px 0", fontSize: 15.5 }}>
                Tạo tài khoản quản trị
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
