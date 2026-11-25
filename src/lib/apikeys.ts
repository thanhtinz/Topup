import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";

export const API_KEY_PREFIX = "bntg_live_";

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createApiKey(userId: number, name: string): Promise<{ raw: string; prefix: string; id: number }> {
  const raw = API_KEY_PREFIX + randomBytes(24).toString("base64url");
  const prefix = raw.slice(0, API_KEY_PREFIX.length + 8);
  const row = await prisma.apiKey.create({
    data: { userId, name: name.slice(0, 60), prefix, keyHash: hashApiKey(raw) },
  });
  return { raw, prefix, id: row.id };
}

export type ApiAuth = { userId: number; keyId: number };

const buckets = new Map<number, { count: number; resetAt: number }>();
export function apiRateOk(keyId: number): boolean {
  const now = Date.now();
  const b = buckets.get(keyId);
  if (!b || b.resetAt <= now) { buckets.set(keyId, { count: 1, resetAt: now + 60_000 }); return true; }
  if (b.count >= 240) return false;
  b.count++;
  return true;
}

export async function authenticateApiKey(req: Request): Promise<ApiAuth | null> {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const raw = bearer || (req.headers.get("x-api-key") ?? "").trim();
  if (!raw || !raw.startsWith(API_KEY_PREFIX) || raw.length > 80) return null;
  const hash = hashApiKey(raw);
  const key = await prisma.apiKey.findUnique({ where: { keyHash: hash }, include: { user: { select: { id: true, active: true } } } });
  if (!key || key.revokedAt || !key.user.active) return null;
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(key.keyHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
    prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => null);
  }
  return { userId: key.userId, keyId: key.id };
}

export function apiOk(data: unknown, status = 200): Response {
  return Response.json({ ok: true, data }, { status });
}

export function apiFail(status: number, code: string, message: string): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

export async function withApiKey(req: Request, fn: (auth: ApiAuth) => Promise<Response>): Promise<Response> {
  const auth = await authenticateApiKey(req);
  if (!auth) return apiFail(401, "UNAUTHORIZED", "API key không hợp lệ hoặc đã bị thu hồi");
  if (!apiRateOk(auth.keyId)) return apiFail(429, "RATE_LIMITED", "Quá 240 yêu cầu/phút cho khoá này");
  return fn(auth);
}
