"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { loginAction, registerAction, forgotPasswordAction, verifyRegisterAction, resetPasswordAction, resendCodeAction } from "@/app/actions";
import AuthCollage from "@/components/AuthCollage";

const GoogleIcon = (
  <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9Z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44Z" /><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9Z" /></svg>
);

const FacebookIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#1877F2" /><path fill="#fff" d="M13.4 20v-6.2h2.1l.3-2.4h-2.4V9.9c0-.7.2-1.2 1.2-1.2h1.3V6.5c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3v1.7H8.7V14h2.1v6h2.6Z" /></svg>
);

type Mode = "login" | "register" | "forgot" | "verify" | "reset";
const MODE_TITLES: Record<Exclude<Mode, "login" | "register">, string> = {
  forgot: "Quên mật khẩu",
  verify: "Xác nhận đăng ký",
  reset: "Đặt lại mật khẩu",
};

export default function AuthGate({ siteName, covers, googleEnabled, facebookEnabled = false, loginLabel, registerLabel }: { siteName: string; covers: string[]; googleEnabled: boolean; facebookEnabled?: boolean; loginLabel: string; registerLabel: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [ref, setRef] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [nextUrl, setNextUrl] = useState("");
  const [emailParam, setEmailParam] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const a = p.get("auth");
    if (a === "login" || a === "register" || a === "forgot" || a === "verify" || a === "reset") { setMode(a); setOpen(true); }
    if (p.get("err")) setErrMsg(p.get("err") ?? "");
    if (p.get("msg")) setOkMsg(p.get("msg") ?? "");
    if (p.get("next")) setNextUrl(p.get("next") ?? "");
    if (p.get("email")) setEmailParam(p.get("email") ?? "");
  }, []);

  const close = () => {
    setOpen(false);
    const u = new URL(window.location.href);
    let changed = false;
    for (const k of ["auth", "err", "msg", "next", "email"]) {
      if (u.searchParams.has(k)) { u.searchParams.delete(k); changed = true; }
    }
    if (changed) window.history.replaceState(null, "", u.pathname + (u.search ? u.search : "") + u.hash);
  };
  const [first, ...rest] = siteName.split(" ");

  useEffect(() => {
    if (open) {
      setRef(new URLSearchParams(window.location.search).get("ref") ?? "");
      const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
      window.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
    }
  }, [open ]);

  const openWith = (m: Mode) => { setMode(m); setErrMsg(""); setOkMsg(""); setOpen(true); };

  const agreeBox = (
    <label className="auth-agree">
      <input type="checkbox" name="agree" value="1" required />
      <span>
        Tôi đồng ý với <Link href="/terms" onClick={close}>Điều khoản dịch vụ</Link> và <Link href="/privacy" onClick={close}>Chính sách bảo mật</Link> của {siteName}
      </span>
    </label>
  );

  const resendForm = (purpose: "register" | "reset") => (
    <form action={resendCodeAction} style={{ marginTop: 10, textAlign: "center" }}>
      <input type="hidden" name="purpose" value={purpose} />
      <input type="hidden" name="email" value={emailParam} />
      <span style={{ fontSize: 13.5, color: "var(--muted)" }}>Chưa nhận được mã? </span>
      <button type="submit" className="auth-linkbtn">Gửi lại mã</button>
    </form>
  );

  return (
    <>
      <button className="btn btn-primary btn-sm" type="button" onClick={() => openWith("login")}>{loginLabel}</button>
      {open && (
        <div className="auth-overlay" role="dialog" aria-modal="true" onClick={close}>
          <div className={`auth-card${covers.length ? "" : " auth-card--empty"}`} onClick={(e) => e.stopPropagation()}>
            <button className="auth-x" type="button" aria-label="Đóng" onClick={close}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
            <AuthCollage covers={covers} />
            <div className="auth-logo">
              <span className="dot" />
              {first}&nbsp;<em>{rest.join(" ") || "SHOP"}</em>
            </div>

            {(mode === "login" || mode === "register") ? (
              <div className="auth-tabs" role="tablist">
                <button type="button" className={mode === "login" ? "on" : ""} onClick={() => openWith("login")}>Đăng nhập</button>
                <button type="button" className={mode === "register" ? "on" : ""} onClick={() => openWith("register")}>Đăng ký</button>
              </div>
            ) : (
              <h3 className="auth-mode-title">{MODE_TITLES[mode]}</h3>
            )}

            <div className="auth-body">
              {errMsg && <div className="form-err" style={{ width: "100%", marginBottom: 12 }}>{errMsg}</div>}
              {okMsg && <div className="form-ok" style={{ width: "100%", marginBottom: 12 }}>{okMsg}</div>}

              {mode === "login" && (
                <>
                  {googleEnabled && (
                    <a className="auth-google" href="/api/auth/google">
                      {GoogleIcon}
                      <span>Đăng nhập bằng Google</span>
                    </a>
                  )}
                  {facebookEnabled && (
                    <a className="auth-google" href="/api/auth/facebook">
                      {FacebookIcon}
                      <span>Đăng nhập bằng Facebook</span>
                    </a>
                  )}
                  <form className="auth-form" action={loginAction} style={{ padding: "18px 0 0", width: "100%" }}>
                    <input type="hidden" name="next" value={nextUrl} />
                    <div className="field"><label htmlFor="am-email">Email</label><input id="am-email" name="email" type="email" required autoComplete="email" /></div>
                    <div className="field"><label htmlFor="am-pass">Mật khẩu</label><input id="am-pass" name="password" type="password" required autoComplete="current-password" /></div>
                    <div className="auth-row-end">
                      <button type="button" className="auth-linkbtn" onClick={() => openWith("forgot")}>Quên mật khẩu?</button>
                    </div>
                    {agreeBox}
                    <button className="btn btn-primary" style={{ width: "100%" }} type="submit">Đăng nhập</button>
                  </form>
                </>
              )}

              {mode === "register" && (
                <>
                  {googleEnabled && (
                    <a className="auth-google" href="/api/auth/google">
                      {GoogleIcon}
                      <span>Đăng nhập bằng Google</span>
                    </a>
                  )}
                  {facebookEnabled && (
                    <a className="auth-google" href="/api/auth/facebook">
                      {FacebookIcon}
                      <span>Đăng nhập bằng Facebook</span>
                    </a>
                  )}
                  <form className="auth-form" action={registerAction} style={{ padding: "18px 0 0", width: "100%" }}>
                    <input type="hidden" name="ref" value={ref} />
                    <div className="field"><label htmlFor="am-name">Họ tên</label><input id="am-name" name="name" required autoComplete="name" /></div>
                    <div className="field"><label htmlFor="am-email2">Email</label><input id="am-email2" name="email" type="email" required autoComplete="email" /></div>
                    <div className="field"><label htmlFor="am-pass2">Mật khẩu (tối thiểu 8 ký tự)</label><input id="am-pass2" name="password" type="password" required autoComplete="new-password" /></div>
                    {agreeBox}
                    <button className="btn btn-primary" style={{ width: "100%" }} type="submit">Đăng ký</button>
                  </form>
                </>
              )}

              {mode === "forgot" && (
                <form className="auth-form" action={forgotPasswordAction} style={{ padding: "6px 0 0", width: "100%" }}>
                  <p className="auth-note">Nhập email của tài khoản — hệ thống sẽ gửi mã xác nhận 6 số để đặt lại mật khẩu.</p>
                  <div className="field"><label htmlFor="am-femail">Email</label><input id="am-femail" name="email" type="email" required autoComplete="email" defaultValue={emailParam} /></div>
                  <button className="btn btn-primary" style={{ width: "100%" }} type="submit">Gửi mã xác nhận</button>
                  <p style={{ textAlign: "center", marginTop: 12 }}>
                    <button type="button" className="auth-linkbtn" onClick={() => openWith("login")}>← Quay lại đăng nhập</button>
                  </p>
                </form>
              )}

              {mode === "verify" && (
                <>
                  <form className="auth-form" action={verifyRegisterAction} style={{ padding: "6px 0 0", width: "100%" }}>
                    <p className="auth-note">Nhập mã 6 số đã gửi tới <strong>{emailParam}</strong>. Mã có hiệu lực trong 10 phút.</p>
                    <input type="hidden" name="email" value={emailParam} />
                    <div className="field"><label htmlFor="am-code">Mã xác nhận</label><input id="am-code" name="code" className="auth-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required placeholder="______" /></div>
                    <button className="btn btn-primary" style={{ width: "100%" }} type="submit">Xác nhận đăng ký</button>
                  </form>
                  {resendForm("register")}
                  <p style={{ textAlign: "center", marginTop: 8 }}>
                    <button type="button" className="auth-linkbtn" onClick={() => openWith("register")}>← Đăng ký lại</button>
                  </p>
                </>
              )}

              {mode === "reset" && (
                <>
                  <form className="auth-form" action={resetPasswordAction} style={{ padding: "6px 0 0", width: "100%" }}>
                    <p className="auth-note">Nhập mã 6 số đã gửi tới <strong>{emailParam}</strong> và đặt mật khẩu mới.</p>
                    <input type="hidden" name="email" value={emailParam} />
                    <div className="field"><label htmlFor="am-rcode">Mã xác nhận</label><input id="am-rcode" name="code" className="auth-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required placeholder="______" /></div>
                    <div className="field"><label htmlFor="am-npass">Mật khẩu mới (tối thiểu 8 ký tự)</label><input id="am-npass" name="password" type="password" required autoComplete="new-password" /></div>
                    <div className="field"><label htmlFor="am-npass2">Nhập lại mật khẩu mới</label><input id="am-npass2" name="confirm" type="password" required autoComplete="new-password" /></div>
                    <button className="btn btn-primary" style={{ width: "100%" }} type="submit">Đặt lại mật khẩu</button>
                  </form>
                  {resendForm("reset")}
                  <p style={{ textAlign: "center", marginTop: 8 }}>
                    <button type="button" className="auth-linkbtn" onClick={() => openWith("login")}>← Quay lại đăng nhập</button>
                  </p>
                </>
              )}
            </div>

            <p className="auth-terms">
              Bằng việc tiếp tục, bạn đồng ý với <Link href="/privacy" onClick={close}>Chính sách bảo mật</Link> và <Link href="/terms" onClick={close}>Điều khoản dịch vụ</Link>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
