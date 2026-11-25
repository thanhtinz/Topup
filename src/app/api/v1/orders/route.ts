import { prisma } from "@/lib/db";
import { apiFail, apiOk, withApiKey } from "@/lib/apikeys";
import { buyPackage } from "@/lib/orders";

export const dynamic = "force-dynamic";

function orderView(o: {
  code: string; status: string; totalCents: number; discountCents: number; clientRef: string | null; createdAt: Date;
  items: Array<{ packageId: number; qty: number; priceCents: number; status: string; fieldsJson: unknown }>;
}) {
  return {
    code: o.code,
    status: o.status,
    totalCents: o.totalCents,
    discountCents: o.discountCents,
    currency: "USD",
    clientRef: o.clientRef,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({ packageId: i.packageId, qty: i.qty, priceCents: i.priceCents, status: i.status, fields: i.fieldsJson })),
  };
}

const includeItems = { items: { select: { packageId: true, qty: true, priceCents: true, status: true, fieldsJson: true } } } as const;

export async function GET(req: Request) {
  return withApiKey(req, async (auth) => {
    const orders = await prisma.order.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: includeItems,
    });
    return apiOk({ orders: orders.map(orderView) });
  });
}

export async function POST(req: Request) {
  return withApiKey(req, async (auth) => {
    let body: Record<string, unknown>;
    try { body = (await req.json()) as Record<string, unknown>; }
    catch { return apiFail(400, "BAD_JSON", "Body phải là JSON hợp lệ"); }

    const packageId = Number(body.packageId);
    if (!Number.isInteger(packageId) || packageId <= 0) return apiFail(400, "BAD_PACKAGE", "packageId không hợp lệ");
    const qtyRaw = Number(body.qty ?? 1);
    const qty = Number.isInteger(qtyRaw) ? Math.min(10, Math.max(1, qtyRaw)) : 0;
    if (!qty) return apiFail(400, "BAD_QTY", "qty phải là số nguyên 1–10");

    const fieldsIn = (body.fields ?? {}) as Record<string, unknown>;
    if (typeof fieldsIn !== "object" || Array.isArray(fieldsIn)) return apiFail(400, "BAD_FIELDS", "fields phải là object");
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(fieldsIn).slice(0, 20)) {
      if (typeof v !== "string" && typeof v !== "number") return apiFail(400, "BAD_FIELDS", `Trường ${k} phải là chuỗi`);
      fields[k.slice(0, 60)] = String(v).slice(0, 300);
    }
    const promoCode = typeof body.promoCode === "string" ? body.promoCode.trim().slice(0, 40) || undefined : undefined;
    const clientRef = typeof body.clientRef === "string" && /^[A-Za-z0-9_-]{4,64}$/.test(body.clientRef.trim()) ? body.clientRef.trim() : undefined;
    if (body.clientRef !== undefined && !clientRef) return apiFail(400, "BAD_CLIENT_REF", "clientRef phải gồm 4–64 ký tự chữ/số, - hoặc _");

    if (clientRef) {
      const existing = await prisma.order.findFirst({ where: { userId: auth.userId, clientRef }, include: includeItems });
      if (existing) return apiOk({ order: orderView(existing), duplicated: true });
    }

    try {
      const order = await buyPackage({ userId: auth.userId, packageId, qty, fields, promoCode, clientRef });
      const full = await prisma.order.findUnique({ where: { id: order.id }, include: includeItems });
      if (!full) return apiFail(500, "ORDER_FAILED", "Tạo đơn thất bại, thử lại sau");
      return apiOk({ order: orderView(full), duplicated: false }, 201);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "PACKAGE_UNAVAILABLE") return apiFail(400, "PACKAGE_UNAVAILABLE", "Gói không tồn tại hoặc đang tắt");
      if (msg.startsWith("MISSING_FIELD:")) return apiFail(400, "MISSING_FIELD", `Thiếu trường bắt buộc: ${msg.slice("MISSING_FIELD:".length)}`);
      if (msg === "PROMO_INVALID") return apiFail(400, "PROMO_INVALID", "Mã giảm giá không hợp lệ hoặc không đủ điều kiện");
      if (msg === "INSUFFICIENT_BALANCE") return apiFail(402, "INSUFFICIENT_BALANCE", "Số dư ví không đủ cho đơn này");
      if (msg === "FLASH_SOLD_OUT") return apiFail(409, "FLASH_SOLD_OUT", "Suất Flash Sale của gói đã hết");
      if (clientRef && (e as { code?: string })?.code === "P2002") {
        const existing = await prisma.order.findFirst({ where: { userId: auth.userId, clientRef }, include: includeItems });
        if (existing) return apiOk({ order: orderView(existing), duplicated: true });
      }
      return apiFail(500, "ORDER_FAILED", "Tạo đơn thất bại, thử lại sau");
    }
  });
}
