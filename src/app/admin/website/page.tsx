import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { Top, Msg } from "../ui";
import { saveSettingsAction, saveGoogleLoginAction, saveFacebookLoginAction, saveWebsiteInfoAction, saveSmtpAction, testSmtpAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminWebsite({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; tab?: string }> }) {
  const { msg, err, tab } = await searchParams;
  const active = ["content", "seo", "google", "facebook", "email"].includes(tab ?? "") ? (tab as string) : "info";
  const s = await getSettings();
  return (
    <div>
      <Top title="Cấu hình website" />
      <Msg msg={msg} err={err} />
      <div className="admin-tabs">
        <Link href="/admin/website?tab=info" className={active === "info" ? "on" : ""}>Thông tin web</Link>
        <Link href="/admin/website?tab=content" className={active === "content" ? "on" : ""}>Nội dung trang</Link>
        <Link href="/admin/website?tab=seo" className={active === "seo" ? "on" : ""}>SEO</Link>
        <Link href="/admin/website?tab=google" className={active === "google" ? "on" : ""}>Đăng nhập Google</Link>
        <Link href="/admin/website?tab=facebook" className={active === "facebook" ? "on" : ""}>Đăng nhập Facebook</Link>
        <Link href="/admin/website?tab=email" className={active === "email" ? "on" : ""}>Email (SMTP)</Link>
      </div>
      {active === "info" && (
      <div className="admin-card">
        <h2>Thông tin web</h2>
        <p className="muted" style={{ marginBottom: 12 }}>Tên web và liên kết web áp cho toàn bộ mọi nơi: header, footer, tiêu đề trang, email.</p>
        <form action={saveWebsiteInfoAction}>
          <div className="field"><label>Tên web</label><input name="site_name" defaultValue={s.site_name} required /></div>
          <div className="field"><label>Liên kết web (domain chính thức)</label><input name="site_url" defaultValue={s.site_url} placeholder="https://..." /></div>
          <div className="field"><label>Đường dẫn nút Vào quản trị (hiện ở trang Hồ sơ khi đăng nhập bằng tài khoản quản trị)</label><input name="admin_entry_url" defaultValue={s.admin_entry_url} placeholder="Để trống = /admin — ví dụ bản VPN: https://bnt-vps.tail312f96.ts.net:8443/admin" /></div>
          <div className="field"><label>Email hỗ trợ</label><input name="support_email" type="email" defaultValue={s.support_email} /></div>
          <div className="field"><label>Khẩu hiệu (tagline — hiện ở chân trang khi chưa có mô tả)</label><input name="site_tagline" defaultValue={s.site_tagline} placeholder="Nạp game tự động 24/7" /></div>
          <div className="field">
            <label>Logo</label>
            {s.logo_url ? <div style={{ margin: "4px 0 8px" }}><img src={s.logo_url} alt="Logo hiện tại" style={{ height: 38, maxWidth: 200, objectFit: "contain" }} /></div> : null}
            <input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" style={{ display: "block" }} />
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{s.logo_url ? "Chọn file mới để thay logo, không chọn thì giữ nguyên." : "Chưa có logo — header đang hiện tên web dạng chữ."}</p>
            {s.logo_url ? <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13, marginTop: 4 }}><input type="checkbox" name="logo_clear" value="1" /> Xoá logo (về tên web dạng chữ)</label> : null}
          </div>
          <div className="field">
            <label>Favicon</label>
            {s.favicon_url ? <div style={{ margin: "4px 0 8px" }}><img src={s.favicon_url} alt="Favicon hiện tại" style={{ width: 32, height: 32, objectFit: "contain" }} /></div> : null}
            <input name="favicon" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/x-icon" style={{ display: "block" }} />
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{s.favicon_url ? "Chọn file mới để thay favicon, không chọn thì giữ nguyên." : "Chưa có favicon riêng."}</p>
            {s.favicon_url ? <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13, marginTop: 4 }}><input type="checkbox" name="favicon_clear" value="1" /> Xoá favicon</label> : null}
          </div>
          <button className="btn btn-primary" type="submit">Lưu cấu hình</button>
        </form>
      </div>
      )}


      {active === "content" && (
      <div className="admin-card">
        <h2>Nội dung trang</h2>
        <p className="muted" style={{ marginBottom: 12 }}>Mọi đoạn chữ giới thiệu trên web đều sửa tại đây. Ô nào để trống thì web dùng văn bản mặc định.</p>
        <form action={saveSettingsAction}>
          <input type="hidden" name="_path" value="/admin/website?tab=content" />
          <div className="form-grid">
            <div className="field"><label>Tiêu đề lớn trang chủ (tiếng Việt)</label><input name="hero_title" defaultValue={s.hero_title} placeholder="Nạp game nhanh. Giá rõ ràng." /></div>
            <div className="field"><label>Tiêu đề lớn trang chủ (English)</label><input name="hero_title_en" defaultValue={s.hero_title_en} placeholder="Fast top-ups. Clear prices." /></div>
            <div className="field"><label>Dòng mô tả dưới tiêu đề (tiếng Việt)</label><input name="hero_sub" defaultValue={s.hero_sub} /></div>
            <div className="field"><label>Dòng mô tả dưới tiêu đề (English)</label><input name="hero_sub_en" defaultValue={s.hero_sub_en} /></div>
            <div className="field" style={{ gridColumn: "1 / -1" }}><label>Mô tả ngắn ở chân trang</label><input name="footer_about" defaultValue={s.footer_about} /></div>
            <div className="field" style={{ gridColumn: "1 / -1" }}><label>Câu hỏi thường gặp — trang Hỗ trợ (mỗi dòng một câu, dạng: Câu hỏi | Câu trả lời)</label><textarea name="support_faq" rows={6} defaultValue={s.support_faq} style={{ width: "100%", borderRadius: 10, border: "1px solid #D8DFEA", padding: "10px 12px", fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" }} /></div>
            <div className="field" style={{ gridColumn: "1 / -1" }}><label>Câu hỏi thường gặp — trang Câu lạc bộ VIP (mỗi dòng một câu, dạng: Câu hỏi | Câu trả lời; biến tự điền: {"{tiers_clause}"} {"{thresholds_clause}"} {"{per_review}"} {"{daily_cap}"} {"{max_pay_percent}"})</label><textarea name="vip_faq" rows={6} defaultValue={s.vip_faq} style={{ width: "100%", borderRadius: 10, border: "1px solid #D8DFEA", padding: "10px 12px", fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" }} /></div>
            <div className="field" style={{ gridColumn: "1 / -1" }}><label>Nội dung trang Điều khoản (dòng bắt đầu bằng "# " là tiêu đề mục; dùng {"{site_name}"} và {"{support_email}"} để chèn tên web/email)</label><textarea name="terms_content" rows={8} defaultValue={s.terms_content} placeholder="Để trống = dùng điều khoản mặc định" style={{ width: "100%", borderRadius: 10, border: "1px solid #D8DFEA", padding: "10px 12px", fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" }} /></div>
            <div className="field" style={{ gridColumn: "1 / -1" }}><label>Nội dung trang Chính sách bảo mật (cùng định dạng Điều khoản)</label><textarea name="privacy_content" rows={8} defaultValue={s.privacy_content} placeholder="Để trống = dùng chính sách mặc định" style={{ width: "100%", borderRadius: 10, border: "1px solid #D8DFEA", padding: "10px 12px", fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" }} /></div>
          </div>
          <div className="form-actions">
            <button className="btn btn-dark" type="submit">Lưu nội dung</button>
          </div>
        </form>
      </div>
      )}
      {active === "seo" && (
      <div className="admin-card">
        <h2>SEO toàn web</h2>
        <p className="muted" style={{ marginBottom: 12 }}>Tiêu đề, mô tả và ảnh chia sẻ mặc định cho toàn web — trang nào không có SEO riêng sẽ dùng bộ này.</p>
        <form action={saveSettingsAction}>
          <input type="hidden" name="_path" value="/admin/website?tab=seo" />
          <div className="field"><label>Meta title mặc định</label><input name="seo_title" defaultValue={s.seo_title} /></div>
          <div className="field"><label>Meta description</label><textarea name="seo_description" rows={3} defaultValue={s.seo_description} style={{ width: "100%", borderRadius: 10, border: "1px solid #D8DFEA", padding: "10px 12px", fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" }} /></div>
          <div className="field"><label>Meta keywords</label><input name="seo_keywords" defaultValue={s.seo_keywords} /></div>
          <div className="field"><label>Ảnh OG khi chia sẻ (URL)</label><input name="og_image" defaultValue={s.og_image} /></div>
          <div className="field"><label>Mã đo lường GA (G-...)</label><input name="ga_id" defaultValue={s.ga_id} /></div>
          <p className="muted">Google Search Console đã xác minh bằng bản ghi TXT trên DNS nên không cần mã xác minh trong trang nữa.</p>
          <div className="form-actions">
            <button className="btn btn-dark" type="submit">Lưu SEO</button>
          </div>
        </form>
      </div>
      )}

      {active === "google" && (
      <div className="admin-card">
        <h2>Đăng nhập Google</h2>
        <p className="muted" style={{ marginBottom: 12 }}>Bật để khách đăng nhập/đăng ký bằng tài khoản Google trong popup đăng nhập. Tạo OAuth client tại Google Cloud Console và khai báo Redirect URI: <code>{(s.site_url || "https://ten-mien-cua-ban") + "/api/auth/google/callback"}</code></p>
        <form action={saveGoogleLoginAction}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", border: "1px solid var(--aline)", borderRadius: 12, background: "#FAFBFE", marginBottom: 14 }}>
            <input type="checkbox" name="google_login_enabled" value="1" defaultChecked={s.google_login_enabled === "1"} style={{ width: 20, height: 20, accentColor: "var(--aaccent)" }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>Bật đăng nhập Google</div>
              <div className="muted" style={{ fontSize: 13 }}>Tắt hoặc thiếu Client ID/Secret thì nút Google tự ẩn khỏi popup.</div>
            </div>
          </div>
          <div className="form-grid">
            <div className="field"><label>Google Client ID</label><input name="google_client_id" defaultValue={s.google_client_id} placeholder="…apps.googleusercontent.com" /></div>
            <div className="field"><label>Google Client Secret {s.google_client_secret ? "(Đã cấu hình — để trống để giữ nguyên)" : ""}</label><input name="google_client_secret" type="password" placeholder={s.google_client_secret ? "Đã cấu hình" : ""} autoComplete="new-password" /></div>
          </div>
          <div className="form-actions">
            <button className="btn btn-dark" type="submit">Lưu đăng nhập Google</button>
          </div>
        </form>
      </div>
      )}
      {active === "email" && (
      <div className="admin-card">
        <h2>Email (SMTP) — mã xác nhận</h2>
        <p className="muted" style={{ marginBottom: 12 }}>Email dùng để gửi mã xác nhận 6 số khi khách đăng ký tài khoản và khi quên mật khẩu. Điền đủ Máy chủ + Tài khoản + Mật khẩu là tính năng tự bật; chưa cấu hình thì đăng ký chạy như cũ và quên mật khẩu báo chưa bật.</p>
        <form action={saveSmtpAction}>
          <div className="form-grid">
            <div className="field"><label>Máy chủ SMTP (host)</label><input name="smtp_host" defaultValue={s.smtp_host} placeholder="mail.bntgame.com" /></div>
            <div className="field"><label>Cổng (port)</label><input name="smtp_port" type="number" defaultValue={s.smtp_port || "587"} /></div>
          </div>
          <div className="form-grid">
            <div className="field"><label>Tài khoản (user)</label><input name="smtp_user" defaultValue={s.smtp_user} placeholder="noreply@bntgame.com" /></div>
            <div className="field"><label>Mật khẩu {s.smtp_pass ? "(Đã cấu hình — để trống để giữ nguyên)" : ""}</label><input name="smtp_pass" type="password" placeholder={s.smtp_pass ? "Đã cấu hình" : ""} autoComplete="new-password" /></div>
          </div>
          <div className="form-grid">
            <div className="field"><label>Email gửi đi (From — để trống = dùng tài khoản)</label><input name="smtp_from" type="email" defaultValue={s.smtp_from} placeholder="noreply@bntgame.com" /></div>
            <div className="field"><label>Bảo mật</label>
              <select name="smtp_secure" defaultValue={s.smtp_secure === "1" ? "1" : "0"}>
                <option value="0">STARTTLS (cổng 587)</option>
                <option value="1">SSL/TLS trực tiếp (cổng 465)</option>
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-dark" type="submit">Lưu cấu hình email</button>
          </div>
        </form>
        <form action={testSmtpAction} style={{ marginTop: 18, borderTop: "1px solid var(--aline)", paddingTop: 16 }}>
          <div className="field"><label>Gửi email thử tới</label><input name="test_email" type="email" placeholder={s.support_email} /></div>
          <div className="form-actions">
            <button className="btn btn-outline" type="submit">Gửi email thử</button>
          </div>
        </form>
      </div>
      )}

      {active === "facebook" && (
      <div className="admin-card">
        <h2>Đăng nhập Facebook</h2>
        <p className="muted" style={{ marginBottom: 12 }}>Bật để khách đăng nhập/đăng ký bằng tài khoản Facebook trong popup đăng nhập. Tạo ứng dụng tại Meta for Developers (loại Đăng nhập Facebook) và khai báo OAuth Redirect URI: <code>{(s.site_url || "https://ten-mien-cua-ban") + "/api/auth/facebook/callback"}</code></p>
        <form action={saveFacebookLoginAction}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", border: "1px solid var(--aline)", borderRadius: 12, background: "#FAFBFE", marginBottom: 14 }}>
            <input type="checkbox" name="fb_login_enabled" value="1" defaultChecked={s.fb_login_enabled === "1"} style={{ width: 20, height: 20, accentColor: "var(--aaccent)" }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>Bật đăng nhập Facebook</div>
              <div className="muted" style={{ fontSize: 13 }}>Tắt hoặc thiếu App ID/Secret thì nút Facebook tự ẩn khỏi popup.</div>
            </div>
          </div>
          <div className="form-grid">
            <div className="field"><label>Facebook App ID</label><input name="fb_app_id" defaultValue={s.fb_app_id} placeholder="1234567890…" /></div>
            <div className="field"><label>Facebook App Secret {s.fb_app_secret ? "(Đã cấu hình — để trống để giữ nguyên)" : ""}</label><input name="fb_app_secret" type="password" placeholder={s.fb_app_secret ? "Đã cấu hình" : ""} autoComplete="new-password" /></div>
          </div>
          <div className="form-actions">
            <button className="btn btn-dark" type="submit">Lưu đăng nhập Facebook</button>
          </div>
        </form>
      </div>
      )}

    </div>
  );
}
