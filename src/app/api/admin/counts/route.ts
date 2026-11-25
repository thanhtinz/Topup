import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const zero = 0;
  const [deposits, tickets, orders, creatorApps, creatorPayouts, partnerApps, partnerPayments] = await Promise.all([
    prisma.depositRequest.count({ where: { status: "PENDING" } }).catch(() => zero),
    prisma.ticket.count({ where: { status: "OPEN" } }).catch(() => zero),
    prisma.order.count({ where: { status: { in: ["PROCESSING", "PARTIAL"] } } }).catch(() => zero),
    prisma.creatorApplication.count({ where: { status: { in: ["PENDING", "UNDER_REVIEW"] } } }).catch(() => zero),
    prisma.creatorPayout.count({ where: { status: { in: ["PENDING", "APPROVED", "PROCESSING"] } } }).catch(() => zero),
    prisma.partnerApplication.count({ where: { status: "SUBMITTED" } }).catch(() => zero),
    prisma.partnerPayment.count({ where: { status: "PENDING_APPROVAL" } }).catch(() => zero),
  ]);
  return NextResponse.json({ deposits, tickets, orders, creatorApps, creatorPayouts, partnerApps, partnerPayments });
}
