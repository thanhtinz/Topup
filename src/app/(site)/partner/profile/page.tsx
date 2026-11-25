import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPartnerForUser, fmtDate } from "@/lib/partner-portal";
import { PARTNER_STATUS } from "@/lib/partnership";
import { updateProfileAction } from "../actions";

export const dynamic = "force-dynamic";

const input: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid #CBD5E1", borderRadius: 10, fontSize: 14, boxSizing: "border-box" };
const label: React.CSSProperties = { display: "block", fontWeight: 600, fontSize: 14, margin: "16px 0 6px" };

export default async function PartnerProfilePage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const partner = await getPartnerForUser(user.id);
  if (!partner || partner.status === "SUSPENDED") return null;
  const sp = await searchParams;
  const profile = partner.profile;
  const socialLinks = Array.isArray(profile?.socialLinksJson) ? (profile.socialLinksJson as string[]).join("\n") : "";
  const paymentNote = (profile?.paymentInfoJson as { note?: string } | null)?.note ?? "";
  const latestApp = await prisma.partnerApplication.findFirst({ where: { partnerId: partner.id }, orderBy: { createdAt: "desc" } });
  const types = Array.isArray(latestApp?.typesJson) ? (latestApp.typesJson as string[]) : [];

  return (
    <div style={{ border: "1px solid #E3E8EF", borderRadius: 16, padding: "22px 24px", background: "#fff" }}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Hồ sơ đối tác</h2>
      {sp.msg && <p style={{ background: "#ECFDF3", border: "1px solid #ABEFC6", borderRadius: 10, padding: "10px 12px" }}>{sp.msg}</p>}
      {sp.err && <p style={{ background: "#FDF1F1", border: "1px solid #F3C2C2", borderRadius: 10, padding: "10px 12px" }}>{sp.err}</p>}

      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px 24px", margin: "6px 0 4px" }}>
        <div><dt style={{ color: "#68707A", fontSize: 13 }}>Tên hiển thị</dt><dd style={{ margin: "2px 0 10px", fontWeight: 600 }}>{partner.displayName}</dd></div>
        <div><dt style={{ color: "#68707A", fontSize: 13 }}>Email liên hệ</dt><dd style={{ margin: "2px 0 10px", fontWeight: 600 }}>{partner.email}</dd></div>
        <div><dt style={{ color: "#68707A", fontSize: 13 }}>Quốc gia</dt><dd style={{ margin: "2px 0 10px", fontWeight: 600 }}>{partner.country || "—"}</dd></div>
        <div><dt style={{ color: "#68707A", fontSize: 13 }}>Trạng thái</dt><dd style={{ margin: "2px 0 10px", fontWeight: 600 }}>{PARTNER_STATUS[partner.status] ?? partner.status}</dd></div>
        <div><dt style={{ color: "#68707A", fontSize: 13 }}>Loại hình hợp tác</dt><dd style={{ margin: "2px 0 10px", fontWeight: 600 }}>{types.length ? types.join(", ") : "—"}</dd></div>
        <div><dt style={{ color: "#68707A", fontSize: 13 }}>Đối tác từ</dt><dd style={{ margin: "2px 0 10px", fontWeight: 600 }}>{fmtDate(partner.createdAt)}</dd></div>
      </dl>
      <p style={{ color: "#68707A", fontSize: 13 }}>Thông tin định danh do đội Partnership quản lý. Cần sửa tên, email hoặc loại hình, hãy liên hệ đội Partnership.</p>

      <form action={updateProfileAction}>
        <label style={label} htmlFor="bio">Giới thiệu</label>
        <textarea id="bio" name="bio" rows={4} style={input} defaultValue={profile?.bio ?? ""} placeholder="Giới thiệu ngắn về bạn / đơn vị của bạn" />
        <label style={label} htmlFor="website">Website</label>
        <input id="website" name="website" style={input} defaultValue={profile?.website ?? ""} placeholder="https://…" />
        <label style={label} htmlFor="socialLinks">Link mạng xã hội / kênh nội dung (mỗi link một dòng)</label>
        <textarea id="socialLinks" name="socialLinks" rows={4} style={input} defaultValue={socialLinks} placeholder={"https://youtube.com/@…\nhttps://tiktok.com/@…"} />
        <label style={label} htmlFor="mediaKitUrl">Link media kit</label>
        <input id="mediaKitUrl" name="mediaKitUrl" style={input} defaultValue={profile?.mediaKitUrl ?? ""} placeholder="https://…" />
        <label style={label} htmlFor="paymentNote">Thông tin nhận thanh toán</label>
        <textarea id="paymentNote" name="paymentNote" rows={3} style={input} defaultValue={paymentNote} placeholder="Ví dụ: USDT (TRC20) — địa chỉ ví; hoặc Ngân hàng — số tài khoản — tên chủ tài khoản" />
        <p style={{ color: "#68707A", fontSize: 13 }}>Thông tin này chỉ đội Partnership của BNTGame nhìn thấy để chuẩn bị thanh toán cho bạn.</p>
        <button type="submit" style={{ background: "#0B63E5", color: "#fff", border: 0, padding: "11px 20px", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>Lưu hồ sơ</button>
      </form>
    </div>
  );
}
