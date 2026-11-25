import { prisma } from "@/lib/db";
import { apiFail, apiOk, withApiKey } from "@/lib/apikeys";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withApiKey(req, async (auth) => {
    const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { balanceCents: true, points: true } });
    if (!user) return apiFail(404, "USER_NOT_FOUND", "Tài khoản không còn tồn tại");
    return apiOk({ balanceCents: user.balanceCents, points: user.points, currency: "USD" });
  });
}
