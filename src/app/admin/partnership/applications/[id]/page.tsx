import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../../../ui";
import { APPLICATION_STATUS } from "@/lib/partnership";
import { reviewPartnerApplicationAction, addApplicationMessageAction } from "../../actions";

export const dynamic = "force-dynamic";

type Social = { platform?: string; url?: string; followers?: number };

export default async function AdminPartnerApplicationDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { id } = await params;
  const { msg, err } = await searchParams;
  const app = await prisma.partnerApplication.findUnique({
    where: { id: Number(id) },
    include: { partner: { select: { id: true, displayName: true } }, messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!app) notFound();
  const types = await prisma.partnershipType.findMany();
  const typeName = (c: string) => types.find((t) => t.code === c)?.name ?? c;
  const typeCodes = Array.isArray(app.typesJson) ? (app.typesJson as string[]) : [];
  const socials = Array.isArray(app.socialLinksJson) ? (app.socialLinksJson as Social[]) : [];
  const extra = app.extraJson && typeof app.extraJson === "object" ? (app.extraJson as Record<string, string>) : {};
  const decided = app.status === "APPROVED" || app.status === "REJECTED";

  return (
    <div>
      <Top title={`Hồ sơ hợp tác #${app.id}`} />
      <Msg msg={msg} err={err} />
      <p style={{ marginBottom: 12 }}><Link href="/admin/partnership/applications" style={{ fontWeight: 600 }}>← Hộp hồ sơ</Link>
        {app.partner && <> · Partner: <Link href={`/admin/partnership/partners/${app.partner.id}`} style={{ fontWeight: 600 }}>{app.partner.displayName}</Link></>}</p>

      <div className="admin-cols">
        <div className="admin-card">
          <div className="app-card-head">
            <strong className="app-name">{app.fullName}</strong>
            <span className={`crt-badge ${app.status === "APPROVED" ? "green" : app.status === "REJECTED" ? "red" : "amber"}`}>{APPLICATION_STATUS[app.status]}</span>
          </div>
          <p className="app-line"><b>Email:</b> {app.email} · <b>Quốc gia:</b> {app.country || "—"} · <b>Loại đối tác:</b> {app.applicantType === "ORGANIZATION" ? "Tổ chức" : "Cá nhân"}</p>
          <p className="app-line"><b>Liên hệ:</b> {app.contactMethod} {app.contactInfo} · <b>Gửi lúc:</b> {app.createdAt.toLocaleString("vi-VN")}</p>
          <p className="app-line"><b>Loại hình:</b> {typeCodes.map(typeName).join(", ")}</p>
          <p className="app-label" style={{ marginTop: 10 }}>Kênh / cộng đồng</p>
          {socials.length === 0 ? <p className="muted">Không khai kênh</p> : socials.map((s, i) => (
            <p key={i} className="app-line"><strong>{s.platform}</strong>: {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.url}</a> : "—"} · {(s.followers ?? 0).toLocaleString()} theo dõi/thành viên</p>
          ))}
          {app.audienceText && <><p className="app-label" style={{ marginTop: 10 }}>Quy mô khán giả</p><p className="app-line">{app.audienceText}</p></>}
          <p className="app-label" style={{ marginTop: 10 }}>Đề xuất hợp tác</p>
          <p className="app-line" style={{ whiteSpace: "pre-wrap" }}>{app.proposalText}</p>
          {app.budgetText && <p className="app-line"><b>Ngân sách mong muốn:</b> {app.budgetText}</p>}
          {Object.keys(extra).length > 0 && (
            <>
              <p className="app-label" style={{ marginTop: 10 }}>Thông tin bổ sung theo loại hình</p>
              {Object.entries(extra).filter(([, v]) => v).map(([k, v]) => (
                <p key={k} className="app-line"><b>{k}:</b> {v}</p>
              ))}
            </>
          )}
          {app.reviewNote && <p className="app-line muted" style={{ marginTop: 10 }}><b>Ghi chú nội bộ:</b> {app.reviewNote}</p>}
          {app.partnerResponse && <p className="app-line" style={{ marginTop: 6 }}><b>Phản hồi đã gửi:</b> {app.partnerResponse}</p>}
        </div>

        <div>
          {!decided && (
            <div className="admin-card">
              <h2 style={{ marginBottom: 10 }}>Xét duyệt hồ sơ</h2>
              <form action={reviewPartnerApplicationAction} style={{ marginBottom: 10 }}>
                <input type="hidden" name="id" value={app.id} />
                <input type="hidden" name="kind" value="approve" />
                <button className="btn btn-dark" type="submit" style={{ width: "100%" }}>Duyệt — tạo hồ sơ Partner</button>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Duyệt chỉ tạo hồ sơ Partner. Affiliate KHÔNG tự bật — bật riêng ở trang Partner khi thỏa thuận yêu cầu.</p>
              </form>
              <form action={reviewPartnerApplicationAction} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                <input type="hidden" name="id" value={app.id} />
                <input type="hidden" name="kind" value="needs_info" />
                <textarea name="partnerResponse" rows={3} placeholder="Thông tin cần bổ sung (gửi cho người nộp qua email/thông báo)..." />
                <input name="reviewNote" placeholder="Ghi chú nội bộ (không gửi đi)" />
                <button className="btn btn-outline" type="submit">Yêu cầu bổ sung thông tin</button>
              </form>
              <div style={{ display: "flex", gap: 8 }}>
                {app.status === "SUBMITTED" && (
                  <form action={reviewPartnerApplicationAction}>
                    <input type="hidden" name="id" value={app.id} />
                    <input type="hidden" name="kind" value="review" />
                    <button className="btn btn-outline btn-sm" type="submit">Đánh dấu đang đánh giá</button>
                  </form>
                )}
                <form action={reviewPartnerApplicationAction} style={{ display: "flex", gap: 6, flex: 1 }}>
                  <input type="hidden" name="id" value={app.id} />
                  <input type="hidden" name="kind" value="reject" />
                  <input name="partnerResponse" placeholder="Lý do từ chối (gửi người nộp)" style={{ flex: 1 }} />
                  <button className="btn btn-outline btn-sm" type="submit" style={{ color: "#B3261E" }}>Từ chối</button>
                </form>
              </div>
            </div>
          )}

          <div className="admin-card">
            <h2 style={{ marginBottom: 10 }}>Trao đổi & ghi chú</h2>
            {app.messages.length === 0 ? <p className="muted">Chưa có ghi chú nào.</p> : (
              <div className="mini-list" style={{ marginBottom: 12 }}>
                {app.messages.map((m) => (
                  <div key={m.id} className="mini-row" style={{ alignItems: "flex-start" }}>
                    <div><p style={{ whiteSpace: "pre-wrap" }}>{m.message}</p>
                      <span className="muted">{m.createdAt.toLocaleString("vi-VN")}</span></div>
                    <span className={`crt-badge ${m.visibility === "PARTNER" ? "blue" : "gray"}`}>{m.visibility === "PARTNER" ? "Gửi đối tác" : "Nội bộ"}</span>
                  </div>
                ))}
              </div>
            )}
            <form action={addApplicationMessageAction} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input type="hidden" name="applicationId" value={app.id} />
              <textarea name="message" rows={3} placeholder="Ghi chú nội bộ hoặc nội dung trao đổi cần lưu vết..." required />
              <div style={{ display: "flex", gap: 8 }}>
                <select name="visibility" style={{ height: 38 }}>
                  <option value="INTERNAL">Nội bộ</option>
                  <option value="PARTNER">Hiển thị cho đối tác (Portal)</option>
                </select>
                <button className="btn btn-dark btn-sm" type="submit">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
