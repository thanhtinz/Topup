import { createHash, randomInt } from "node:crypto";
import { prisma } from "./db";

export const CODE_TTL_MS = 10 * 60_000;
export const CODE_MAX_ATTEMPTS = 5;
export const CODE_COOLDOWN_MS = 60_000;

export type CodePurpose = "REGISTER" | "RESET";

function hashCode(email: string, purpose: CodePurpose, code: string): string {
  return createHash("sha256").update(`${email.toLowerCase()}|${purpose}|${code}`).digest("hex");
}

export async function issueEmailCode(
  email: string,
  purpose: CodePurpose,
  payload = "",
): Promise<{ code: string } | { cooldown: true } | { error: string }> {
  const addr = email.trim().toLowerCase();
  const last = await prisma.emailCode.findFirst({
    where: { email: addr, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (last && Date.now() - last.createdAt.getTime() < CODE_COOLDOWN_MS) {
    return { cooldown: true };
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.emailCode.deleteMany({ where: { email: addr, purpose } });
  await prisma.emailCode.create({
    data: {
      email: addr,
      purpose,
      codeHash: hashCode(addr, purpose, code),
      payload,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return { code };
}

export type VerifyResult =
  | { ok: true; payload: string }
  | { ok: false; reason: "NONE" | "EXPIRED" | "INVALID" | "TOO_MANY" };

export async function verifyEmailCode(email: string, purpose: CodePurpose, code: string): Promise<VerifyResult> {
  const addr = email.trim().toLowerCase();
  const row = await prisma.emailCode.findFirst({
    where: { email: addr, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false, reason: "NONE" };
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.emailCode.delete({ where: { id: row.id } });
    return { ok: false, reason: "EXPIRED" };
  }
  if (row.attempts >= CODE_MAX_ATTEMPTS) {
    await prisma.emailCode.delete({ where: { id: row.id } });
    return { ok: false, reason: "TOO_MANY" };
  }
  const given = String(code ?? "").trim();
  if (!/^\d{6}$/.test(given) || hashCode(addr, purpose, given) !== row.codeHash) {
    const attempts = row.attempts + 1;
    if (attempts >= CODE_MAX_ATTEMPTS) {
      await prisma.emailCode.delete({ where: { id: row.id } });
      return { ok: false, reason: "TOO_MANY" };
    }
    await prisma.emailCode.update({ where: { id: row.id }, data: { attempts } });
    return { ok: false, reason: "INVALID" };
  }
  await prisma.emailCode.delete({ where: { id: row.id } });
  return { ok: true, payload: row.payload };
}

export async function peekEmailCodePayload(email: string, purpose: CodePurpose): Promise<string | null> {
  const row = await prisma.emailCode.findFirst({
    where: { email: email.trim().toLowerCase(), purpose },
    orderBy: { createdAt: "desc" },
  });
  return row ? row.payload : null;
}

export const CODE_ERROR_TEXT: Record<Exclude<VerifyResult, { ok: true }>["reason"], string> = {
  NONE: "Chưa có mã xác nhận — hãy yêu cầu gửi mã trước",
  EXPIRED: "Mã xác nhận đã hết hạn — hãy yêu cầu gửi lại mã",
  INVALID: "Mã xác nhận không đúng",
  TOO_MANY: "Nhập sai quá nhiều lần — hãy yêu cầu gửi lại mã mới",
};
