import { prisma } from "@/lib/db";
import { Top } from "../ui";

export const dynamic = "force-dynamic";

export default async function AdminAudit() {
  const logs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div>
      <Top title="Nhật ký hoạt động" />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Chi tiết</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}><td>{l.createdAt.toLocaleString("vi-VN")}</td><td>{l.user?.email ?? "—"}</td><td>{l.action}</td><td>{l.detail}</td></tr>
            ))}
            {!logs.length && <tr><td colSpan={4} className="muted">Chưa có nhật ký nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
