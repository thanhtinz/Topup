import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../../../ui";
import { CAMPAIGN_STATUS, DELIVERABLE_STATUS, ensurePartnershipTypes } from "@/lib/partnership";
import { fmtUSD } from "@/lib/money";
import { savePartnerCampaignAction, invitePartnerAction, setJoinStatusAction, saveDeliverableAction, reviewDeliverableAction } from "../../actions";

export const dynamic = "force-dynamic";

const CAMPAIGN_STATUSES = ["DRAFT", "PROPOSED", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"];

export default async function AdminPartnerCampaignDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { id } = await params;
  const { msg, err } = await searchParams;
  await ensurePartnershipTypes();
  const campaign = await prisma.partnerCampaign.findUnique({
    where: { id: Number(id) },
    include: {
      joins: {
        include: { partner: { select: { id: true, displayName: true } }, deliverables: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!campaign) notFound();
  const [types, allPartners] = await Promise.all([
    prisma.partnershipType.findMany({ orderBy: { sort: "asc" } }),
    prisma.partner.findMany({ where: { status: "ACTIVE" }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true } }),
  ]);
  const joinedIds = new Set(campaign.joins.map((j) => j.partnerId));
  const invitable = allPartners.filter((p) => !joinedIds.has(p.id));
  const dstr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

  return (
    <div>
      <Top title={`Chiến dịch ${campaign.code} — ${campaign.name}`} />
      <Msg msg={msg} err={err} />
      <p style={{ marginBottom: 12 }}><Link href="/admin/partnership/campaigns" style={{ fontWeight: 600 }}>← Danh sách chiến dịch</Link></p>

      <div className="admin-card">
        <h2 style={{ marginBottom: 10 }}>Thông tin chiến dịch</h2>
        <form action={savePartnerCampaignAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="hidden" name="id" value={campaign.id} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input name="name" defaultValue={campaign.name} required style={{ flex: "2 1 240px" }} />
            <select name="typeCode" defaultValue={campaign.typeCode} style={{ height: 46, flex: "1 1 160px" }}>
              {types.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
            <select name="status" defaultValue={campaign.status} style={{ height: 46, flex: "1 1 160px" }}>
              {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{CAMPAIGN_STATUS[s]}</option>)}
            </select>
            <input name="budget" type="number" step="0.01" min="0" defaultValue={(campaign.budgetCents / 100).toFixed(2)} style={{ flex: "0 1 150px" }} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input name="objective" defaultValue={campaign.objective} placeholder="Mục tiêu" style={{ flex: "2 1 240px" }} />
            <label style={{ fontSize: 13 }}>Từ <input name="startAt" type="date" defaultValue={dstr(campaign.startAt)} /></label>
            <label style={{ fontSize: 13 }}>Đến <input name="endAt" type="date" defaultValue={dstr(campaign.endAt)} /></label>
          </div>
          <textarea name="brief" rows={4} defaultValue={campaign.brief} placeholder="Brief chiến dịch..." />
          <button className="btn btn-dark" type="submit" style={{ alignSelf: "flex-start" }}>Lưu chiến dịch</button>
        </form>
      </div>

      <div className="admin-card">
        <h2 style={{ marginBottom: 10 }}>Partner trong chiến dịch</h2>
        <form action={invitePartnerAction} style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input type="hidden" name="campaignId" value={campaign.id} />
          <select name="partnerId" required style={{ height: 38, flex: "1 1 220px" }}>
            <option value="">Chọn Partner để mời...</option>
            {invitable.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
          <button className="btn btn-dark btn-sm" type="submit">Mời vào chiến dịch</button>
        </form>
        {campaign.joins.length === 0 ? <p className="muted">Chưa có Partner nào trong chiến dịch.</p> : campaign.joins.map((j) => (
          <div key={j.id} style={{ borderTop: "1px solid #E6EDF6", paddingTop: 12, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <strong>{j.partner.displayName}</strong>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className={`crt-badge ${j.status === "ACCEPTED" ? "green" : j.status === "INVITED" ? "amber" : "gray"}`}>{j.status}</span>
                {j.status === "INVITED" && (
                  <>
                    <form action={setJoinStatusAction}><input type="hidden" name="id" value={j.id} /><input type="hidden" name="campaignId" value={campaign.id} /><input type="hidden" name="kind" value="accept" /><button className="btn btn-dark btn-sm" type="submit">Ghi nhận chấp nhận</button></form>
                    <form action={setJoinStatusAction}><input type="hidden" name="id" value={j.id} /><input type="hidden" name="campaignId" value={campaign.id} /><input type="hidden" name="kind" value="decline" /><button className="btn btn-outline btn-sm" type="submit">Từ chối</button></form>
                  </>
                )}
                {j.status !== "REMOVED" && (
                  <form action={setJoinStatusAction}><input type="hidden" name="id" value={j.id} /><input type="hidden" name="campaignId" value={campaign.id} /><input type="hidden" name="kind" value="remove" /><button className="btn btn-outline btn-sm" type="submit">Loại khỏi chiến dịch</button></form>
                )}
              </div>
            </div>
            <div className="mini-list" style={{ marginTop: 8 }}>
              {j.deliverables.length === 0 ? <p className="muted">Chưa có đầu việc nào.</p> : j.deliverables.map((d) => (
                <div key={d.id} className="mini-row" style={{ alignItems: "flex-start" }}>
                  <div>
                    <strong>{d.title}</strong>{d.description && <> — {d.description}</>}
                    <br /><span className="muted">Hạn: {d.dueAt ? d.dueAt.toLocaleDateString("vi-VN") : "chưa đặt"}{d.submittedUrl && <> · <a href={d.submittedUrl} target="_blank" rel="noreferrer">Link nộp bài</a></>}{d.reviewNote && <> · Ghi chú: {d.reviewNote}</>}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span className={`crt-badge ${d.status === "APPROVED" ? "green" : d.status === "REJECTED" ? "red" : "amber"}`}>{DELIVERABLE_STATUS[d.status]}</span>
                    {d.status === "PENDING" && (
                      <form action={reviewDeliverableAction}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="backTo" value={`/admin/partnership/campaigns/${campaign.id}`} /><input type="hidden" name="kind" value="submit" /><input name="submittedUrl" placeholder="Link bài đã nộp" style={{ width: 170 }} /><button className="btn btn-outline btn-sm" type="submit">Ghi nhận đã nộp</button></form>
                    )}
                    {d.status === "SUBMITTED" && (
                      <form action={reviewDeliverableAction}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="backTo" value={`/admin/partnership/campaigns/${campaign.id}`} /><input type="hidden" name="kind" value="review" /><button className="btn btn-outline btn-sm" type="submit">Bắt đầu duyệt</button></form>
                    )}
                    {d.status === "IN_REVIEW" && (
                      <>
                        <form action={reviewDeliverableAction}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="backTo" value={`/admin/partnership/campaigns/${campaign.id}`} /><input type="hidden" name="kind" value="approve" /><button className="btn btn-dark btn-sm" type="submit">Nghiệm thu</button></form>
                        <form action={reviewDeliverableAction} style={{ display: "flex", gap: 4 }}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="backTo" value={`/admin/partnership/campaigns/${campaign.id}`} /><input type="hidden" name="kind" value="revision" /><input name="reviewNote" placeholder="Yêu cầu sửa..." required style={{ width: 150 }} /><button className="btn btn-outline btn-sm" type="submit">Yêu cầu sửa</button></form>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <form action={saveDeliverableAction} style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <input type="hidden" name="campaignPartnerId" value={j.id} />
              <input type="hidden" name="campaignId" value={campaign.id} />
              <input name="title" required placeholder="Đầu việc mới (VD: Đăng video review)" style={{ flex: "2 1 220px" }} />
              <input name="description" placeholder="Mô tả / yêu cầu" style={{ flex: "2 1 220px" }} />
              <input name="dueAt" type="date" />
              <button className="btn btn-outline btn-sm" type="submit">+ Thêm đầu việc</button>
            </form>
          </div>
        ))}
      </div>

      <p className="muted">Ngân sách chiến dịch: {campaign.budgetCents > 0 ? fmtUSD(campaign.budgetCents) : "chưa đặt"} — khoản chi tạo ở trang Thanh toán Partnership, chọn chiến dịch này để đối chiếu ngân sách.</p>
    </div>
  );
}
