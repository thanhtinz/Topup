import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readSyncState, runCatalogSync, runGiftSync, runSyncAll } from "@/lib/sync";

async function guard() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF")) return null;
  return user;
}

type SyncCode = "FZR" | "ERIS" | "STEAMGIFT" | "ALL";

function validCode(raw: string): SyncCode | null {
  return raw === "FZR" || raw === "ERIS" || raw === "STEAMGIFT" || raw === "ALL" ? raw : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const code = validCode((await params).code);
  if (!code) return NextResponse.json({ error: "bad provider" }, { status: 400 });
  return NextResponse.json(await readSyncState(code));
}

export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = await guard();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const code = validCode((await params).code);
  if (!code) return NextResponse.json({ error: "bad provider" }, { status: 400 });
  const cur = await readSyncState(code);
  if (cur.status === "running") return NextResponse.json(cur);
  if (code === "STEAMGIFT") void runGiftSync(user.id);
  else if (code === "ALL") void runSyncAll(user.id);
  else void runCatalogSync(code);
  return NextResponse.json({ ...cur, status: "running", phase: "Đang bắt đầu...", startedAt: Date.now(), finishedAt: 0, message: "" });
}
