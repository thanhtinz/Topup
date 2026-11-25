import Link from "next/link";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../../ui";
import { PARTNER_STATUS } from "@/lib/partnership";

export const dynamic = "force-dynamic";

export default async function AdminPartners({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; q?: string; status?: string }> }) {
  const { msg, err, q, status } = await searchParams;
  const partners = await prisma.partner.findMany({
    where: {
      status: status && ["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status) ? status : undefined,
      OR: q ? [{ displayName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { campaignJoins: true, payments: true, agreements: true } } },
  });

  return (
    <div>
      <Top title="Partnership — Đối tác" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <form method="get" style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <input name="q" defaultValue={q ?? ""} placeholder="Tìm theo tên hoặc email..." style={{ flex: "1 1 220px" }} />
          <select name="status" defaultValue={status ?? ""} style={{ height: 38 }}>
            <option value="">Mọi trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Tạm ngưng</option>
            <option value="SUSPENDED">Đã khóa</option>
          </select>
          <button className="btn btn-dark btn-sm" type="submit">Lọc</button>
        </form>
        {partners.length === 0 ? <p className="muted">Chưa có Partner nào. Partner được tạo khi duyệt một hồ sơ hợp tác.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Partner</th><th>Loại</th><th>Quốc gia</th><th>Trạng thái</th><th>Affiliate</th><th>Chiến dịch</th><th>Thỏa thuận</th><th>Khoản chi</th><th></th></tr></thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.displayName}</strong><br /><span className="muted">{p.email}</span></td>
                    <td>{p.applicantType === "ORGANIZATION" ? "Tổ chức" : "Cá nhân"}</td>
                    <td>{p.country || "—"}</td>
                    <td><span className={`crt-badge ${p.status === "ACTIVE" ? "green" : p.status === "SUSPENDED" ? "red" : "gray"}`}>{PARTNER_STATUS[p.status]}</span></td>
                    <td>{p.creatorId ? <span className="crt-badge blue">Đã bật</span> : <span className="muted">Chưa bật</span>}</td>
                    <td>{p._count.campaignJoins}</td>
                    <td>{p._count.agreements}</td>
                    <td>{p._count.payments}</td>
                    <td><Link className="btn btn-outline btn-sm" href={`/admin/partnership/partners/${p.id}`}>Chi tiết</Link></td>
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
