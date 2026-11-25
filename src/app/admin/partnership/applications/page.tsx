import Link from "next/link";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../../ui";
import { APPLICATION_STATUS, ensurePartnershipTypes } from "@/lib/partnership";

export const dynamic = "force-dynamic";

const STATUSES = ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO", "APPROVED", "REJECTED"];

export default async function AdminPartnerApplications({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; status?: string; type?: string; q?: string }> }) {
  const { msg, err, status, type, q } = await searchParams;
  await ensurePartnershipTypes();
  const types = await prisma.partnershipType.findMany({ orderBy: { sort: "asc" } });
  const apps = await prisma.partnerApplication.findMany({
    where: {
      status: status && STATUSES.includes(status) ? status : undefined,
      OR: q ? [{ fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const filtered = type ? apps.filter((a) => (Array.isArray(a.typesJson) ? (a.typesJson as string[]) : []).includes(type)) : apps;
  const counts = await prisma.partnerApplication.groupBy({ by: ["status"], _count: true });
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div>
      <Top title="Partnership — Đơn hợp tác" />
      <Msg msg={msg} err={err} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Link className={`btn btn-sm ${!status ? "btn-dark" : "btn-outline"}`} href="/admin/partnership/applications">Tất cả</Link>
        {STATUSES.map((s) => (
          <Link key={s} className={`btn btn-sm ${status === s ? "btn-dark" : "btn-outline"}`} href={`/admin/partnership/applications?status=${s}`}>
            {APPLICATION_STATUS[s]} ({countOf(s)})
          </Link>
        ))}
      </div>
      <div className="admin-card">
        <form method="get" style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q ?? ""} placeholder="Tìm theo tên hoặc email..." style={{ flex: "1 1 220px" }} />
          <select name="type" defaultValue={type ?? ""} style={{ height: 38 }}>
            <option value="">Mọi loại hình</option>
            {types.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
          </select>
          <button className="btn btn-dark btn-sm" type="submit">Lọc</button>
        </form>
        {filtered.length === 0 ? <p className="muted">Không có hồ sơ nào khớp bộ lọc.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Người nộp</th><th>Loại hình</th><th>Quốc gia</th><th>Ngày gửi</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.fullName}</strong><br /><span className="muted">{a.email} · {a.applicantType === "ORGANIZATION" ? "Tổ chức" : "Cá nhân"}</span></td>
                    <td>{(Array.isArray(a.typesJson) ? (a.typesJson as string[]) : []).map((c) => types.find((t) => t.code === c)?.name ?? c).join(", ")}</td>
                    <td>{a.country || "—"}</td>
                    <td>{a.createdAt.toLocaleString("vi-VN")}</td>
                    <td><span className={`crt-badge ${a.status === "APPROVED" ? "green" : a.status === "REJECTED" ? "red" : "amber"}`}>{APPLICATION_STATUS[a.status]}</span></td>
                    <td><Link className="btn btn-outline btn-sm" href={`/admin/partnership/applications/${a.id}`}>Chi tiết</Link></td>
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
