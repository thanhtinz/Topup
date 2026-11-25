import Link from "next/link";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../../ui";
import { DELIVERABLE_STATUS } from "@/lib/partnership";
import { reviewDeliverableAction } from "../actions";

export const dynamic = "force-dynamic";

const STATUSES = ["PENDING", "SUBMITTED", "IN_REVIEW", "REVISION_REQUIRED", "APPROVED", "REJECTED"];

export default async function AdminDeliverables({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; status?: string }> }) {
  const { msg, err, status } = await searchParams;
  const items = await prisma.deliverable.findMany({
    where: { status: status && STATUSES.includes(status) ? status : undefined },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { campaignPartner: { include: { partner: { select: { id: true, displayName: true } }, campaign: { select: { id: true, name: true, code: true } } } } },
  });
  const now = new Date();

  return (
    <div>
      <Top title="Partnership — Đầu việc & nghiệm thu" />
      <Msg msg={msg} err={err} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Link className={`btn btn-sm ${!status ? "btn-dark" : "btn-outline"}`} href="/admin/partnership/deliverables">Tất cả</Link>
        {STATUSES.map((s) => (
          <Link key={s} className={`btn btn-sm ${status === s ? "btn-dark" : "btn-outline"}`} href={`/admin/partnership/deliverables?status=${s}`}>{DELIVERABLE_STATUS[s]}</Link>
        ))}
      </div>
      <div className="admin-card">
        {items.length === 0 ? <p className="muted">Chưa có đầu việc nào.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Đầu việc</th><th>Partner</th><th>Chiến dịch</th><th>Hạn</th><th>Trạng thái</th><th style={{ minWidth: 300 }}>Thao tác</th></tr></thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.title}</strong>{d.submittedUrl && <><br /><a href={d.submittedUrl} target="_blank" rel="noreferrer">Link nộp bài</a></>}{d.reviewNote && <><br /><span className="muted">Ghi chú: {d.reviewNote}</span></>}</td>
                    <td><Link href={`/admin/partnership/partners/${d.campaignPartner.partner.id}`}>{d.campaignPartner.partner.displayName}</Link></td>
                    <td><Link href={`/admin/partnership/campaigns/${d.campaignPartner.campaign.id}`}>{d.campaignPartner.campaign.code}</Link></td>
                    <td style={{ color: d.dueAt && d.dueAt < now && d.status !== "APPROVED" ? "#B3261E" : undefined, fontWeight: d.dueAt && d.dueAt < now && d.status !== "APPROVED" ? 700 : 400 }}>
                      {d.dueAt ? d.dueAt.toLocaleDateString("vi-VN") : "—"}
                    </td>
                    <td><span className={`crt-badge ${d.status === "APPROVED" ? "green" : d.status === "REJECTED" ? "red" : "amber"}`}>{DELIVERABLE_STATUS[d.status]}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {d.status === "PENDING" && (
                          <form action={reviewDeliverableAction} style={{ display: "flex", gap: 4 }}>
                            <input type="hidden" name="id" value={d.id} /><input type="hidden" name="kind" value="submit" />
                            <input name="submittedUrl" placeholder="Link bài đã nộp" style={{ width: 150 }} />
                            <button className="btn btn-outline btn-sm" type="submit">Ghi nhận đã nộp</button>
                          </form>
                        )}
                        {d.status === "SUBMITTED" && (
                          <form action={reviewDeliverableAction}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="kind" value="review" /><button className="btn btn-outline btn-sm" type="submit">Bắt đầu duyệt</button></form>
                        )}
                        {d.status === "IN_REVIEW" && (
                          <>
                            <form action={reviewDeliverableAction}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="kind" value="approve" /><button className="btn btn-dark btn-sm" type="submit">Nghiệm thu</button></form>
                            <form action={reviewDeliverableAction} style={{ display: "flex", gap: 4 }}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="kind" value="revision" /><input name="reviewNote" placeholder="Yêu cầu sửa..." required style={{ width: 140 }} /><button className="btn btn-outline btn-sm" type="submit">Yêu cầu sửa</button></form>
                            <form action={reviewDeliverableAction} style={{ display: "flex", gap: 4 }}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="kind" value="reject" /><input name="reviewNote" placeholder="Lý do không đạt..." required style={{ width: 140 }} /><button className="btn btn-outline btn-sm" type="submit" style={{ color: "#B3261E" }}>Không đạt</button></form>
                          </>
                        )}
                        {d.status === "REVISION_REQUIRED" && (
                          <form action={reviewDeliverableAction}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="kind" value="submit" /><button className="btn btn-outline btn-sm" type="submit">Ghi nhận nộp lại</button></form>
                        )}
                      </div>
                    </td>
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
