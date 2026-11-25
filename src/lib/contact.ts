import { prisma } from "./db";

export type FloatingContact = { name: string; href: string; image?: string | null; bg: string };

export function normalizeContactLink(name: string, raw: string): string {
  const v = (raw || "").trim();
  if (!v) return "";
  if (/^(https?:|tel:|mailto:)/i.test(v)) return v;
  const lower = name.toLowerCase();
  const digits = v.replace(/[\s.]/g, "");
  if (lower.includes("zalo")) return `https://zalo.me/${digits}`;
  if (lower.includes("telegram")) return `https://t.me/${v.replace(/^@/, "")}`;
  if (lower.includes("facebook") || lower.includes("fanpage") || lower.includes("messenger")) return `https://facebook.com/${v.replace(/^\//, "")}`;
  if (lower.includes("hotline") || lower.includes("điện thoại") || lower.includes("phone")) return `tel:${digits}`;
  if (/^0\d{8,10}$/.test(digits)) return `https://zalo.me/${digits}`;
  return `https://${v}`;
}

export function contactColor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("zalo")) return "#0068ff";
  if (lower.includes("telegram")) return "#229ed9";
  if (lower.includes("facebook") || lower.includes("fanpage") || lower.includes("messenger")) return "#1877f2";
  if (lower.includes("hotline") || lower.includes("điện thoại") || lower.includes("phone")) return "#059669";
  if (lower.includes("youtube")) return "#ff0000";
  if (lower.includes("tiktok")) return "#111827";
  if (lower.includes("discord")) return "#5865f2";
  return "#475569";
}

export async function getFloatingContacts(): Promise<FloatingContact[]> {
  const rows = await prisma.contactWidget.findMany({ where: { active: true }, orderBy: [{ sort: "asc" }, { id: "asc" }] });
  return rows
    .map((r) => ({ name: r.name, href: normalizeContactLink(r.name, r.link), image: r.image, bg: contactColor(r.name) }))
    .filter((c) => c.href);
}

export async function listContactWidgets() {
  const rows = await prisma.contactWidget.findMany({ orderBy: [{ sort: "asc" }, { id: "asc" }] });
  return rows.map((r) => ({ ...r, bg: contactColor(r.name) }));
}
