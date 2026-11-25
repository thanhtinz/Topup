import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { getSepayConfig, extractDepositCode, claimAndCredit } from "@/lib/gateways";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const cfg = await getSepayConfig();
  const auth = req.headers.get("authorization") || "";
  const presented = auth.startsWith("Apikey ") ? auth.slice(7) : "";
  let authorized = false;
  if (cfg.secret && presented) {
    const a = Buffer.from(presented);
    const b = Buffer.from(cfg.secret);
    if (a.length === b.length && timingSafeEqual(a, b)) authorized = true;
  }
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const content = String(body.content || body.description || "");
  const amount = Number(body.transferAmount || body.amount || 0);
  const txId = String(body.id || body.referenceCode || "");
  const type = String(body.transferType || "in");
  if (type !== "in" || !amount || amount <= 0) return NextResponse.json({ success: true, skipped: "not a credit" });
  if (!txId) return NextResponse.json({ success: true, skipped: "missing tx id" });
  if (!cfg.enabled) return NextResponse.json({ success: true, skipped: "sepay disabled" });

  const code = extractDepositCode(content);
  if (!code) return NextResponse.json({ success: true, skipped: "code not found" });
  const dep = await prisma.depositRequest.findUnique({ where: { code } });
  if (!dep || dep.method !== "SEPAY") return NextResponse.json({ success: true, skipped: "deposit not found" });
  if (dep.status !== "PENDING") return NextResponse.json({ success: true, skipped: "deposit not pending" });
  if (dep.vndAmount == null || dep.vndAmount !== amount) {
    return NextResponse.json({ success: true, skipped: "amount mismatch", expected: dep.vndAmount, received: amount });
  }

  try {
    const credited = await prisma.$transaction(async (tx) => {
      await tx.webhookReceipt.create({ data: { ref: `sepay:${txId}` } });
      return claimAndCredit(tx, dep.id, dep.amountCents, "Nạp chuyển khoản qua SePay");
    });
    return NextResponse.json({ success: true, credited, deposit: dep.code });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") {
      const receipt = await prisma.webhookReceipt.findUnique({ where: { ref: `sepay:${txId}` } }).catch(() => null);
      if (receipt) return NextResponse.json({ success: true, skipped: "duplicate" });
    }
    return NextResponse.json({ success: false, error: "processing_failed" }, { status: 500 });
  }
}
