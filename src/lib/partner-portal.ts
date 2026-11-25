import { prisma } from "./db";

export async function getPartnerForUser(userId: number) {
  return prisma.partner.findUnique({ where: { userId }, include: { profile: true } });
}

export const JOIN_STATUS_LABEL: Record<string, string> = {
  INVITED: "Được mời — chờ phản hồi",
  ACCEPTED: "Đã tham gia",
  DECLINED: "Đã từ chối",
  REMOVED: "Đã gỡ khỏi chiến dịch",
};

export function fmtCur(cents: number, code: string): string {
  try {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: code || "USD" }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${code || "USD"}`;
  }
}

export function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
