import { prisma } from "@/lib/db";
import { apiFail, apiOk, withApiKey } from "@/lib/apikeys";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return withApiKey(req, async (auth) => {
    const { code } = await params;
    const order = await prisma.order.findFirst({
      where: { code: code.slice(0, 32), userId: auth.userId },
      include: { items: { select: { packageId: true, qty: true, priceCents: true, status: true, fieldsJson: true } } },
    });
    if (!order) return apiFail(404, "ORDER_NOT_FOUND", "Không tìm thấy đơn với mã này");
    return apiOk({
      order: {
        code: order.code,
        status: order.status,
        totalCents: order.totalCents,
        discountCents: order.discountCents,
        currency: "USD",
        clientRef: order.clientRef,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        items: order.items.map((i) => ({ packageId: i.packageId, qty: i.qty, priceCents: i.priceCents, status: i.status, fields: i.fieldsJson })),
      },
    });
  });
}
