import nodemailer from "nodemailer";
import { getSettings } from "./settings";
import { openSecret } from "./gateways";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const s = await getSettings();
  return {
    host: (s.smtp_host ?? "").trim(),
    port: parseInt(s.smtp_port ?? "587", 10) || 587,
    user: (s.smtp_user ?? "").trim(),
    pass: openSecret(s.smtp_pass),
    from: (s.smtp_from ?? "").trim(),
    secure: s.smtp_secure === "1",
  };
}

export async function isMailConfigured(): Promise<boolean> {
  const c = await getSmtpConfig();
  return !!(c.host && c.user && c.pass);
}

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const cfg = await getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) return false;
  const s = await getSettings();
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 12000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
    });
    await transporter.sendMail({
      from: `"${s.site_name || "BNT Game"}" <${cfg.from || cfg.user}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendCodeEmail(to: string, code: string, purpose: "REGISTER" | "RESET"): Promise<boolean> {
  const s = await getSettings();
  const site = s.site_name || "BNT Game";
  const isReg = purpose === "REGISTER";
  const title = isReg ? "Xác nhận đăng ký tài khoản" : "Đặt lại mật khẩu";
  const intro = isReg
    ? `Bạn vừa đăng ký tài khoản tại ${site}. Nhập mã dưới đây để hoàn tất đăng ký:`
    : `Bạn vừa yêu cầu đặt lại mật khẩu tại ${site}. Nhập mã dưới đây để tiếp tục:`;
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#22304a">
    <h2 style="margin:0 0 12px;font-size:20px">${title}</h2>
    <p style="margin:0 0 16px;line-height:1.55">${intro}</p>
    <div style="background:#EEF4FF;border:1px solid #B9D2F7;border-radius:12px;padding:18px;text-align:center">
      <span style="font-size:34px;font-weight:800;letter-spacing:10px;color:#0B63E5">${code}</span>
    </div>
    <p style="margin:16px 0 0;line-height:1.55;color:#5b6b84">Mã có hiệu lực trong 10 phút. Nếu bạn không thực hiện yêu cầu này, cứ bỏ qua email này.</p>
    <p style="margin:20px 0 0;color:#8a97ab;font-size:13px">${site} · Email tự động, vui lòng không trả lời.</p>
  </div>`;
  return sendMail(to, `[${site}] ${title} — mã ${code}`, html);
}
