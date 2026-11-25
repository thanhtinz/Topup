import Link from "next/link";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../../../ui";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = { CREATOR: "Affiliate", VERIFIED: "Đã xác thực", OFFICIAL: "Đối tác chính thức" };

export default async function AdminCreatorList({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; q?: string }> }) {
  const { msg, err, q } = await searchParams;
  const creators = await prisma.creator.findMany({
    where: q ? { OR: [{ displayName: { contains: q, mode: "insensitive" } }, { code: { contains: q.toUpperCase() } }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { level: true, user: { select: { email: true } }, _count: { select: { commissions: true, clicks: true } } },
  });

  return (
    <div>
      <Top title="Affiliate — Danh sách" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <form method="get" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input name="q" defaultValue={q ?? ""} placeholder="Tìm theo tên hoặc mã..." style={{ flex: 1 }} />
          <button className="btn btn-dark btn-sm" type="submit">Tìm</button>
        </form>
        {creators.length === 0 ? <p className="muted">Chưa có Affiliate nào.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Affiliate</th><th>Mã</th><th>Cấp</th><th>Huy hiệu</th><th>Trạng thái</th><th>Click</th><th>Hoa hồng</th><th></th></tr></thead>
              <tbody>
                {creators.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.displayName}</strong><br /><span className="muted">{c.user.email}</span></td>
                    <td>{c.code}</td>
                    <td>{c.level?.name ?? "—"}{c.customRateBps != null ? <><br /><span className="muted">riêng {(c.customRateBps / 100).toFixed(2)}%</span></> : null}</td>
                    <td>{TIER_LABEL[c.tier] ?? c.tier}</td>
                    <td>{c.status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa"}</td>
                    <td>{c._count.clicks.toLocaleString()}</td>
                    <td>{c._count.commissions}</td>
                    <td><Link className="btn btn-outline btn-sm" href={`/admin/partnership/affiliate/${c.id}`}>Chi tiết</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
