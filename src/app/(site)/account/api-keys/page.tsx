import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import KeysClient from "./KeysClient";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const user = await requireUser();
  const keys = await prisma.apiKey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <main className="bsx">
      <div className="container" style={{ maxWidth: 880, paddingTop: 28, paddingBottom: 52 }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>API đấu nối</h1>
        <p className="muted" style={{ marginBottom: 16, maxWidth: 720 }}>
          Dùng API key để đấu nối hệ thống của bạn với BNTGame: lấy danh mục game & gói, kiểm tra số dư ví, tạo đơn nạp và tra trạng thái đơn — tiền trừ trực tiếp từ ví của bạn.
          Xem <Link href="/api-docs" style={{ fontWeight: 600 }}>tài liệu API</Link> để biết chi tiết endpoint và ví dụ gọi.
        </p>
        <KeysClient initial={keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          createdAt: k.createdAt.toISOString(),
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          revokedAt: k.revokedAt?.toISOString() ?? null,
        }))} />
      </div>
    </main>
  );
}
