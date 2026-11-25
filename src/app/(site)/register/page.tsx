import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function RegisterShim({ searchParams }: { searchParams: Promise<{ err?: string; ref?: string }> }) {
  const { err, ref } = await searchParams;
  const refMatch = /^KH(\d+)$/i.exec((ref ?? "").trim());
  if (refMatch) {
    const referrerId = parseInt(refMatch[1], 10);
    if (referrerId > 0) {
      await prisma.user.update({ where: { id: referrerId }, data: { refClicks: { increment: 1 } } }).catch(() => undefined);
    }
  }
  const q = new URLSearchParams({ auth: "register" });
  if (err) q.set("err", err);
  if (ref) q.set("ref", ref);
  redirect("/?" + q.toString());
}
