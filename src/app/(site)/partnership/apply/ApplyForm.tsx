"use client";
import { useMemo, useState } from "react";
import { submitPartnershipApplicationAction } from "../actions";

type PType = { code: string; name: string; tagline: string };
type SocialRow = { platform: string; url: string; followers: string };

const PLATFORMS = ["YouTube", "TikTok", "Twitch", "Facebook", "Discord", "Instagram", "Website", "Khác"];

export default function PartnershipApplyForm({ types, preType, defaults }: { types: PType[]; preType?: string; defaults: { name: string; email: string } }) {
  const [selected, setSelected] = useState<string[]>(preType && types.some((t) => t.code === preType) ? [preType] : []);
  const [applicantType, setApplicantType] = useState("INDIVIDUAL");
  const [rows, setRows] = useState<SocialRow[]>([{ platform: "YouTube", url: "", followers: "" }]);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [agree, setAgree] = useState(false);
  const [sending, setSending] = useState(false);

  const typesJson = useMemo(() => JSON.stringify(selected), [selected]);
  const socialJson = useMemo(
    () => JSON.stringify(rows.map((r) => ({ platform: r.platform, url: r.url, followers: parseInt(r.followers || "0", 10) || 0 }))),
    [rows],
  );
  const extraJson = useMemo(() => JSON.stringify(extra), [extra]);

  const toggle = (code: string) =>
    setSelected((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));
  const setRow = (i: number, patch: Partial<SocialRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setEx = (k: string, v: string) => setExtra((e) => ({ ...e, [k]: v }));

  const has = (code: string) => selected.includes(code);
  const showEvent = has("SPONSORSHIP");
  const showBiz = has("BUSINESS") || applicantType === "ORGANIZATION";
  const showRate = has("CREATOR") || has("STREAMER") || has("MEDIA");

  return (
    <form
      action={submitPartnershipApplicationAction}
      onSubmit={() => setSending(true)}
      className="crt-apply"
    >
      <input type="hidden" name="typesJson" value={typesJson} />
      <input type="hidden" name="socialLinksJson" value={socialJson} />
      <input type="hidden" name="extraJson" value={extraJson} />
      <input type="text" name="website2" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} aria-hidden />

      <section className="crt-card">
        <h3><span className="step-n">1</span> Bạn là ai & muốn hợp tác theo hình thức nào?</h3>
        <div className="fld">
          <span>Loại đối tác</span>
          <div className="pt-chips">
            {([["INDIVIDUAL", "Cá nhân"], ["ORGANIZATION", "Tổ chức / Doanh nghiệp"]] as const).map(([v, label]) => (
              <label key={v} className="pt-chip">
                <input type="radio" name="applicantType" value={v} checked={applicantType === v} onChange={() => setApplicantType(v)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="fld">
          <span>Loại hình hợp tác (chọn một hoặc nhiều)</span>
          <div className="pt-chips">
            {types.map((t) => (
              <label key={t.code} className="pt-chip">
                <input type="checkbox" checked={selected.includes(t.code)} onChange={() => toggle(t.code)} />
                <span>{t.name}</span>
              </label>
            ))}
          </div>
          {selected.length === 0 && <p className="fld-hint">Chọn ít nhất một loại hình để tiếp tục.</p>}
        </div>
      </section>

      <section className="crt-card">
        <h3><span className="step-n">2</span> Thông tin liên hệ</h3>
        <div className="grid2">
          <label className="fld"><span>{applicantType === "ORGANIZATION" ? "Tên tổ chức / pháp nhân" : "Họ và tên"} *</span>
            <input name="fullName" required defaultValue={defaults.name} placeholder="VD: Nguyễn Văn A / Công ty ABC" /></label>
          <label className="fld"><span>Email *</span>
            <input name="email" type="email" required defaultValue={defaults.email} placeholder="email@vidu.com" /></label>
          <label className="fld"><span>Quốc gia / Khu vực *</span>
            <input name="country" required placeholder="VD: Việt Nam" /></label>
          <label className="fld"><span>Cách liên hệ ưu tiên</span>
            <input name="contactMethod" placeholder="Email / Telegram / Discord..." /></label>
          <label className="fld"><span>Thông tin liên hệ (ID / số điện thoại)</span>
            <input name="contactInfo" placeholder="VD: @username" /></label>
        </div>
      </section>

      <section className="crt-card">
        <h3><span className="step-n">3</span> Kênh & cộng đồng của bạn</h3>
        {rows.map((r, i) => (
          <div key={i} className="chan-row">
            <select value={r.platform} onChange={(e) => setRow(i, { platform: e.target.value })} aria-label="Nền tảng">
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input value={r.url} onChange={(e) => setRow(i, { url: e.target.value })} placeholder="Đường dẫn kênh / cộng đồng" inputMode="url" />
            <input value={r.followers} onChange={(e) => setRow(i, { followers: e.target.value.replace(/[^0-9]/g, "") })} placeholder="Người theo dõi / thành viên" inputMode="numeric" />
            {rows.length > 1 && <button type="button" className="btn btn-outline btn-sm" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>Xoá</button>}
          </div>
        ))}
        {rows.length < 8 && <button type="button" className="btn btn-outline btn-sm" onClick={() => setRows((rs) => [...rs, { platform: "YouTube", url: "", followers: "" }])}>+ Thêm kênh</button>}
        <label className="fld" style={{ marginTop: 12 }}><span>Quy mô khán giả / cộng đồng (mô tả thêm nếu cần)</span>
          <input name="audienceText" placeholder="VD: Khán giả chủ yếu 16–24 tuổi tại Việt Nam, MAU cộng đồng ~20.000" /></label>
      </section>

      <section className="crt-card">
        <h3><span className="step-n">4</span> Đề xuất hợp tác</h3>
        <label className="fld"><span>Mục tiêu & ý tưởng hợp tác *</span>
          <textarea name="proposalText" required rows={5} placeholder="Bạn muốn hợp tác nội dung gì, cho game/chủ đề nào, dự kiến triển khai ra sao, quyền lợi hai bên thế nào..." /></label>
        <label className="fld"><span>Ngân sách / mức phí mong muốn</span>
          <input name="budgetText" placeholder="VD: 300 USD / video — hoặc để trống nếu muốn thương lượng" /></label>
        {showRate && (
          <label className="fld"><span>Rate card (bảng giá tham khảo của bạn)</span>
            <textarea rows={3} value={extra.rateCard ?? ""} onChange={(e) => setEx("rateCard", e.target.value)} placeholder="VD: Video review 8–12 phút: ...; Bài đăng cộng đồng: ..." /></label>
        )}
        {showEvent && (
          <div className="grid2">
            <label className="fld"><span>Tên sự kiện / giải đấu</span>
              <input value={extra.eventName ?? ""} onChange={(e) => setEx("eventName", e.target.value)} placeholder="Tên sự kiện" /></label>
            <label className="fld"><span>Ngày tổ chức dự kiến</span>
              <input value={extra.eventDate ?? ""} onChange={(e) => setEx("eventDate", e.target.value)} placeholder="VD: 20/12/2026" /></label>
            <label className="fld"><span>Hình thức (online / offline, địa điểm)</span>
              <input value={extra.eventFormat ?? ""} onChange={(e) => setEx("eventFormat", e.target.value)} placeholder="VD: Online trên Discord" /></label>
            <label className="fld"><span>Số người tham gia dự kiến</span>
              <input value={extra.expectedAttendees ?? ""} onChange={(e) => setEx("expectedAttendees", e.target.value)} placeholder="VD: 500" /></label>
            <label className="fld" style={{ gridColumn: "1 / -1" }}><span>Gói tài trợ mong muốn & quyền lợi nhà tài trợ</span>
              <textarea rows={3} value={extra.sponsorPackages ?? ""} onChange={(e) => setEx("sponsorPackages", e.target.value)} placeholder="Các gói tài trợ, vị trí logo, số bài đăng, quyền lợi truyền thông..." /></label>
          </div>
        )}
        {showBiz && (
          <div className="grid2">
            <label className="fld"><span>Tên tổ chức (nếu khác tên ở bước 2)</span>
              <input value={extra.orgName ?? ""} onChange={(e) => setEx("orgName", e.target.value)} /></label>
            <label className="fld"><span>Website tổ chức</span>
              <input value={extra.orgWebsite ?? ""} onChange={(e) => setEx("orgWebsite", e.target.value)} placeholder="https://" /></label>
            <label className="fld"><span>Lĩnh vực hoạt động</span>
              <input value={extra.industry ?? ""} onChange={(e) => setEx("industry", e.target.value)} placeholder="VD: Phát hành game, agency truyền thông..." /></label>
            <label className="fld"><span>Người đại diện</span>
              <input value={extra.representative ?? ""} onChange={(e) => setEx("representative", e.target.value)} /></label>
          </div>
        )}
      </section>

      <label className="crt-agree">
        <input type="checkbox" name="consent" value="1" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
        <span>Tôi đồng ý để BNTGame xử lý thông tin trong hồ sơ này cho mục đích đánh giá hợp tác, theo <a href="/terms" target="_blank" rel="noreferrer">Điều khoản sử dụng</a> và <a href="/privacy" target="_blank" rel="noreferrer">Chính sách bảo mật</a>. *</span>
      </label>

      <button className="btn btn-primary btn-lg" type="submit" disabled={sending || selected.length === 0 || !agree} style={{ width: "100%" }}>
        {sending ? "Đang gửi hồ sơ..." : "Gửi hồ sơ hợp tác"}
      </button>
      <p className="fld-hint" style={{ textAlign: "center" }}>Đội Partnership xem xét và phản hồi qua email, thường trong 1–3 ngày làm việc. Gửi hồ sơ không đồng nghĩa đã ký thỏa thuận.</p>
    </form>
  );
}
