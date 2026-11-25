import crypto from "node:crypto";

const DEV_SESSION = "dev-only-secret-change-me";
const DEV_KEY = "dev-only-key-change-me";

export function assertProductionSecrets() {
  if (process.env.NODE_ENV !== "production") return;
  const s = process.env.SESSION_SECRET;
  if (!s || s === DEV_SESSION) throw new Error("SESSION_SECRET chưa được cấu hình cho production");
  if (!process.env.SETTINGS_ENC_KEY && !s) throw new Error("SETTINGS_ENC_KEY chưa được cấu hình cho production");
}

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!s || s === DEV_SESSION)) {
    throw new Error("SESSION_SECRET chưa được cấu hình cho production");
  }
  return s || DEV_SESSION;
}

function key() {
  const raw = process.env.SETTINGS_ENC_KEY || process.env.SESSION_SECRET || DEV_KEY;
  if (process.env.NODE_ENV === "production" && raw === DEV_KEY) {
    throw new Error("SETTINGS_ENC_KEY chưa được cấu hình cho production");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(enc: string): string {
  if (!enc) return "";
  try {
    const [iv, tag, data] = enc.split(".").map((s) => Buffer.from(s, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function signSession(payload: string): string {
  const mac = crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

export function verifySession(token: string | undefined): { userId: number; role: string } | null {
  if (!token) return null;
  const [b64, mac] = token.split(".");
  if (!b64 || !mac) return null;
  const secret = sessionSecret();
  const expected = crypto.createHmac("sha256", secret).update(Buffer.from(b64, "base64url").toString()).digest("base64url");
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const obj = JSON.parse(Buffer.from(b64, "base64url").toString());
    if (typeof obj.userId !== "number" || Date.now() > obj.exp) return null;
    return { userId: obj.userId, role: obj.role };
  } catch {
    return null;
  }
}

export function makeSessionToken(userId: number, role: string): string {
  return signSession(JSON.stringify({ userId, role, exp: Date.now() + 30 * 24 * 3600 * 1000 }));
}
