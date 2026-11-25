import { NextResponse } from "next/server";
import { recoverStuckOrders } from "@/lib/recovery";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return NextResponse.json({ error: "CRON_SECRET_NOT_CONFIGURED" }, { status: 503 });
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : req.headers.get("x-cron-secret") ?? "";
  if (provided !== secret) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const summary = await recoverStuckOrders();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
