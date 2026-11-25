import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/settings";

const PRIORITIES = ["ERIS", "FZR", "ERIS_ONLY", "FZR_ONLY"];

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me || (me.role !== "ADMIN" && me.role !== "STAFF")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { gameId?: number; priority?: string; kind?: string } | null;
  const gameId = Number(body?.gameId);
  if (!Number.isInteger(gameId) || gameId <= 0) {
    return NextResponse.json({ error: "gameId không hợp lệ" }, { status: 400 });
  }
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true, priority: true, compareApproved: true } });
  if (!game) return NextResponse.json({ error: "Không thấy game" }, { status: 404 });

  if (typeof body?.priority === "string") {
    if (!PRIORITIES.includes(body.priority)) {
      return NextResponse.json({ error: "Chế độ nguồn không hợp lệ" }, { status: 400 });
    }
    await prisma.game.update({ where: { id: gameId }, data: { priority: body.priority } });
    await audit(me.id, "game.priority", `${gameId} -> ${body.priority} (tại chỗ)`);
    return NextResponse.json({ ok: true, priority: body.priority, compareApproved: game.compareApproved });
  }
  if (typeof body?.kind === "string") {
    if (body.kind !== "approve" && body.kind !== "unapprove") {
      return NextResponse.json({ error: "kind không hợp lệ" }, { status: 400 });
    }
    const approved = body.kind === "approve";
    await prisma.game.update({ where: { id: gameId }, data: { compareApproved: approved } });
    await audit(me.id, "game.compare", `${gameId} -> ${body.kind} (tại chỗ)`);
    return NextResponse.json({ ok: true, priority: game.priority, compareApproved: approved });
  }
  return NextResponse.json({ error: "Thiếu priority hoặc kind" }, { status: 400 });
}
