import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../../../ui";
import { PARTNER_STATUS, CAMPAIGN_STATUS, AGREEMENT_STATUS, PAYMENT_STATUS, PROPOSAL_STATUS } from "@/lib/partnership";
import { fmtUSD } from "@/lib/money";
import { savePartnerAction, enableAffiliateAction, saveProposalAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AdminPartnerDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { id } = await params;
  const { msg, err } = await searchParams;
  const partner = await prisma.partner.findUnique({
    where: { id: Number(id) },
    include: {
      profile: true,
      creator: { select: { id: true, code: true } },
      applications: { orderBy: { createdAt: "desc" }, take: 5 },
      proposals: { orderBy: { createdAt: "desc" }, take: 5 },
      campaignJoins: { include: { campaign: true }, orderBy: { createdAt: "desc" }, take: 8 },
      agreements: { orderBy: { createdAt: "desc" }, take: 5 },
      payments: { orderBy: { createdAt: "desc" }, take: 8 },
      messages: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  if (!partner) notFound();

  return (
    <div>
      <Top title={`Partner — ${partner.displayName}`} />
      <Msg msg={msg} err={err} />
      <p style={{ marginBottom: 12 }}><Link href="/admin/partnership/partners" style={{ fontWeight: 600 }}>← Danh sách Partner</Link></p>

      <div className="admin-cols">
        <div className="admin-card">
          <h2 style={{ marginBottom: 10 }}>Hồ sơ Partner</h2>
          <form action={savePartnerAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="hidden" name="id" value={partner.id} />
            <label className="fld"><span>Tên hiển thị</span><input name="displayName" defaultValue={partner.displayName} /></label>
            <label className="fld"><span>Tên pháp lý / tổ chức</span><input name="legalName" defaultValue={partner.legalName} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label className="fld"><span>Quốc gia</span><input name="country" defaultValue={partner.country} /></label>
              <label className="fld"><span>Trạng thái</span>
                <select name="status" defaultValue={partner.status} style={{ height: 46 }}>
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="INACTIVE">Tạm ngưng</option>
                  <option value="SUSPENDED">Đã khóa</option>
                </select></label>
            </div>
            <label className="fld"><span>Giới thiệu (bio)</span><textarea name="bio" rows={3} defaultValue={partner.profile?.bio ?? ""} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label className="fld"><span>Website</span><input name="website" defaultValue={partner.profile?.website ?? ""} /></label>
              <label className="fld"><span>Media kit (URL)</span><input name="mediaKitUrl" defaultValue={partner.profile?.mediaKitUrl ?? ""} /></label>
            </div>
            <label className="fld"><span>Ghi chú nội bộ</span><textarea name="internalNote" rows={2} defaultValue={partner.internalNote} /></label>
            <button className="btn btn-dark" type="submit">Lưu hồ sơ</button>
          </form>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
            Email: {partner.email} · Loại: {partner.applicantType === "ORGANIZATION" ? "Tổ chức" : "Cá nhân"} ·
            Tài khoản: {partner.userId ? `#${partner.userId}` : "chưa gắn tài khoản"} · Tạo: {partner.createdAt.toLocaleDateString("vi-VN")}
          </p>
        </div>

        <div>
          <div className="admin-card">
            <h2 style={{ marginBottom: 8 }}>Module Affiliate</h2>
            {partner.creator ? (
              <p>Đã bật — mã giới thiệu <strong>{partner.creator.code}</strong>. Quản lý hoa hồng tại <Link href={`/admin/creators/list`} style={{ fontWeight: 600 }}>Creator — Danh sách</Link>.</p>
            ) : (
              <>
                <p className="muted" style={{ marginBottom: 10 }}>Chưa bật. Chỉ bật khi thỏa thuận của Partner là Affiliate (có link/mã giới thiệu và hoa hồng theo đơn).</p>
                <form action={enableAffiliateAction}>
                  <input type="hidden" name="id" value={partner.id} />
                  <button className="btn btn-dark btn-sm" type="submit" disabled={!partner.userId}>Bật Affiliate cho Partner này</button>
                  {!partner.userId && <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Partner chưa có tài khoản BNTGame nên chưa bật được.</p>}
                </form>
              </>
            )}
          </div>

          <div className="admin-card">
            <h2 style={{ marginBottom: 10 }}>Tạo đề xuất cho Partner này</h2>
            <form action={saveProposalAction} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input type="hidden" name="partnerId" value={partner.id} />
              <input name="title" required placeholder="Tiêu đề đề xuất" />
              <div style={{ display: "flex", gap: 8 }}>
                <input name="price" type="number" step="0.01" min="0" placeholder="Giá (USD)" style={{ flex: 1 }} />
                <input name="expiresAt" type="date" style={{ flex: 1 }} />
              </div>
              <input name="scopeText" placeholder="Phạm vi công việc tóm tắt" />
              <button className="btn btn-dark btn-sm" type="submit">Tạo đề xuất</button>
            </form>
          </div>
        </div>
      </div>

      <div className="admin-cols">
        <div className="admin-card">
          <h2 style={{ marginBottom: 10 }}>Chiến dịch tham gia</h2>
          {partner.campaignJoins.length === 0 ? <p className="muted">Chưa tham gia chiến dịch nào.</p> : (
            <div className="mini-list">
              {partner.campaignJoins.map((j) => (
                <div key={j.id} className="mini-row">
                  <div><Link href={`/admin/partnership/campaigns/${j.campaign.id}`}><strong>{j.campaign.name}</strong></Link><br />
                    <span className="muted">{j.campaign.code} · tham gia: {j.status}</span></div>
                  <span className="crt-badge blue">{CAMPAIGN_STATUS[j.campaign.status]}</span>
                </div>
              ))}
            </div>
          )}
          <h2 style={{ margin: "16px 0 10px" }}>Thỏa thuận</h2>
          {partner.agreements.length === 0 ? <p className="muted">Chưa có thỏa thuận nào.</p> : (
            <div className="mini-list">
              {partner.agreements.map((a) => (
                <div key={a.id} className="mini-row">
                  <div><strong>{a.title}</strong> <span className="muted">v{a.version}</span><br />
                    <span className="muted">{a.feeCents > 0 ? fmtUSD(a.feeCents) : "Không ghi phí"}</span></div>
                  <span className="crt-badge gray">{AGREEMENT_STATUS[a.status]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="admin-card">
          <h2 style={{ marginBottom: 10 }}>Thanh toán gần đây</h2>
          {partner.payments.length === 0 ? <p className="muted">Chưa có khoản chi nào.</p> : (
            <div className="mini-list">
              {partner.payments.map((p) => (
                <div key={p.id} className="mini-row">
                  <div><strong>{fmtUSD(p.amountCents)} {p.currency !== "USD" ? p.currency : ""}</strong><br />
                    <span className="muted">{p.type} · {p.method || "chưa chọn cách trả"} · {p.createdAt.toLocaleDateString("vi-VN")}</span></div>
                  <span className={`crt-badge ${p.status === "PAID" ? "green" : "amber"}`}>{PAYMENT_STATUS[p.status]}</span>
                </div>
              ))}
            </div>
          )}
          <h2 style={{ margin: "16px 0 10px" }}>Đề xuất gần đây</h2>
          {partner.proposals.length === 0 ? <p className="muted">Chưa có đề xuất nào.</p> : (
            <div className="mini-list">
              {partner.proposals.map((p) => (
                <div key={p.id} className="mini-row">
                  <div><strong>{p.title}</strong><br /><span className="muted">{p.priceCents > 0 ? fmtUSD(p.priceCents) : "—"}</span></div>
                  <span className="crt-badge gray">{PROPOSAL_STATUS[p.status]}</span>
                </div>
              ))}
            </div>
          )}
          <h2 style={{ margin: "16px 0 10px" }}>Ghi chú & trao đổi</h2>
          {partner.messages.length === 0 ? <p className="muted">Chưa có ghi chú nào.</p> : (
            <div className="mini-list">
              {partner.messages.map((m) => (
                <div key={m.id} className="mini-row" style={{ alignItems: "flex-start" }}>
                  <div><p style={{ whiteSpace: "pre-wrap" }}>{m.message}</p><span className="muted">{m.createdAt.toLocaleString("vi-VN")}</span></div>
                  <span className={`crt-badge ${m.visibility === "PARTNER" ? "blue" : "gray"}`}>{m.visibility === "PARTNER" ? "Đối tác" : "Nội bộ"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
