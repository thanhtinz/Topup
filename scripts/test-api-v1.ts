import { prisma } from "../src/lib/db";
import { createApiKey } from "../src/lib/apikeys";

const BASE = "http://localhost:3107/api/v1";
async function call(path: string, key?: string, init?: RequestInit) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* không phải JSON */ }
  return { status: res.status, json: json as { ok?: boolean; data?: Record<string, never>; error?: { code?: string } } };
}

async function main() {
  const demo = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!demo) throw new Error("thiếu user demo");
  await prisma.user.update({ where: { id: demo.id }, data: { balanceCents: 100000 } });
  const pkg = await prisma.package.findFirst({
    where: { active: true, priceCents: { gt: 0 }, game: { slug: "free-fire", active: true } },
    orderBy: { priceCents: "asc" },
    select: { id: true, priceCents: true, name: true },
  });
  if (!pkg) throw new Error("thiếu gói free-fire");
  console.log("PKG:", pkg.id, pkg.name, pkg.priceCents, "¢");

  const { raw, id: keyId } = await createApiKey(demo.id, "E2E test");
  console.log("KEY prefix:", raw.slice(0, 17));

  const bad = await call("/balance", "bntg_live_sai_key_nay_123456");
  console.log("BAD KEY ->", bad.status, bad.json?.error?.code, bad.status === 401 ? "PASS" : "FAIL");

  const games = await call("/games", raw);
  const gameCount = (games.json?.data as { games?: unknown[] } | undefined)?.games?.length ?? 0;
  console.log("GAMES ->", games.status, "games:", gameCount, gameCount > 0 ? "PASS" : "FAIL");

  const bal1 = await call("/balance", raw);
  console.log("BALANCE ->", bal1.status, JSON.stringify(bal1.json?.data));

  const ref = "E2E-" + Date.now();
  const ord1 = await call("/orders", raw, { method: "POST", body: JSON.stringify({ packageId: pkg.id, qty: 1, fields: { uid: "998877665" }, clientRef: ref }) });
  const o1 = (ord1.json?.data as { order?: { code: string; totalCents: number }; duplicated?: boolean } | undefined);
  console.log("ORDER1 ->", ord1.status, o1?.order?.code, o1?.order?.totalCents + "¢", "dup:", o1?.duplicated, ord1.status === 201 ? "PASS" : "FAIL " + JSON.stringify(ord1.json));

  const ord2 = await call("/orders", raw, { method: "POST", body: JSON.stringify({ packageId: pkg.id, qty: 1, fields: { uid: "998877665" }, clientRef: ref }) });
  const o2 = (ord2.json?.data as { order?: { code: string }; duplicated?: boolean } | undefined);
  console.log("ORDER2 (same clientRef) ->", ord2.status, o2?.order?.code, "dup:", o2?.duplicated, o2?.duplicated === true && o2?.order?.code === o1?.order?.code ? "PASS" : "FAIL");

  const bal2 = await call("/balance", raw);
  const spent = (bal1.json?.data as { balanceCents?: number })?.balanceCents! - (bal2.json?.data as { balanceCents?: number })?.balanceCents!;
  console.log("SPENT (chỉ được trừ 1 lần):", spent, "¢", spent === o1?.order?.totalCents ? "PASS" : "FAIL");

  const got = await call(`/orders/${o1?.order?.code}`, raw);
  console.log("GET ORDER ->", got.status, (got.json?.data as { order?: { status: string } })?.order?.status, got.status === 200 ? "PASS" : "FAIL");

  const missing = await call("/orders", raw, { method: "POST", body: JSON.stringify({ packageId: pkg.id, qty: 1, fields: {} }) });
  console.log("MISSING FIELD ->", missing.status, missing.json?.error?.code, missing.json?.error?.code === "MISSING_FIELD" ? "PASS" : "FAIL " + JSON.stringify(missing.json));

  await prisma.apiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });
  const after = await call("/balance", raw);
  console.log("REVOKED KEY ->", after.status, after.status === 401 ? "PASS" : "FAIL");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
