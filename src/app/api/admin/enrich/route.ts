import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readEnrichState, runEnrichment } from "@/lib/enrich";

export async function GET() {
  const me = await getCurrentUser();
  if (!me || (me.role !== "ADMIN" && me.role !== "STAFF")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await readEnrichState());
}

export async function POST() {
  const me = await getCurrentUser();
  if (!me || (me.role !== "ADMIN" && me.role !== "STAFF")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  void runEnrichment();
  const s = await readEnrichState();
  return NextResponse.json({ ...s, status: s.status === "running" ? s.status : "running", phase: s.phase || "Đang bắt đầu..." });
}
