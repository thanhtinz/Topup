import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createApiKey } from "@/lib/apikeys";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  let name = "";
  try { name = String(((await req.json()) as { name?: unknown })?.name ?? "").trim(); } catch { }
  const activeCount = await prisma.apiKey.count({ where: { userId: user.id, revokedAt: null } });
  if (activeCount >= 10) return Response.json({ ok: false, error: "LIMIT", message: "Tối đa 10 khoá đang hoạt động" }, { status: 400 });
  const created = await createApiKey(user.id, name);
  return Response.json({ ok: true, key: created.raw, prefix: created.prefix, id: created.id });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  let id = 0;
  try { id = Number(((await req.json()) as { id?: unknown })?.id ?? 0); } catch { /* id không hợp lệ */ }
  if (!id) return Response.json({ ok: false, error: "BAD_ID" }, { status: 400 });
  const res = await prisma.apiKey.updateMany({ where: { id, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (res.count === 0) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true });
}
