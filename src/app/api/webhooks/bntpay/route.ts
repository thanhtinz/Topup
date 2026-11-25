import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBntpayConfig, bntpayVerifySignature, settleBntpayDeposit, parseProviderData } from "@/lib/gateways";

export const dynamic = "force-dynamic";

const MAX_BODY = 16_384;

export async function POST(req: NextRequest) {
  const raw = await req.text().catch(() => "");
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY) {
    return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }
  const cfg = await getBntpayConfig().catch(() => null);
  const ts = req.headers.get("x-bntpay-webhook-timestamp") || req.headers.get("x-bntpay-timestamp") || "";
  const sig = req.headers.get("x-bntpay-webhook-signature") || req.headers.get("x-bntpay-signature") || "";
  const valid = !!cfg && bntpayVerifySignature(cfg.webhookSecret, ts, raw, sig);
  if (!valid) return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });

  let payload: Record<string, unknown> | null = null;
  try { payload = JSON.parse(raw) as Record<string, unknown>; } catch { payload = null; }
  const externalOrderId = String(payload?.externalOrderId || "");
  const eventId = String(payload?.eventId || "");
  if (!externalOrderId) return NextResponse.json({ ok: false, processed: false, error: "missing_external_order_id" }, { status: 500 });

  const dep = await prisma.depositRequest.findUnique({ where: { code: externalOrderId } }).catch(() => null);
  if (!dep || dep.method !== "BNTPAY") {
    return NextResponse.json({ ok: false, processed: false, error: "deposit_not_found" }, { status: 500 });
  }
  void parseProviderData(dep.providerData);

  const receiptRef = eventId ? `bntpay:${eventId}` : "";
  let receiptClaimed = false;
  if (receiptRef) {
    try {
      await prisma.webhookReceipt.create({ data: { ref: receiptRef } });
      receiptClaimed = true;
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") {
        const receipt = await prisma.webhookReceipt.findUnique({ where: { ref: receiptRef } }).catch(() => null);
        if (receipt) return NextResponse.json({ ok: true, duplicate: true });
      }
      return NextResponse.json({ ok: false, processed: false, error: "processing_failed" }, { status: 500 });
    }
  }

  try {
    const r = await settleBntpayDeposit(dep.id, payload ?? {});
    return NextResponse.json({ ok: true, processed: r.ok, reason: r.reason });
  } catch {
    if (receiptClaimed) await prisma.webhookReceipt.delete({ where: { ref: receiptRef } }).catch(() => {});
    return NextResponse.json({ ok: false, processed: false, error: "processing_failed" }, { status: 500 });
  }
}
