import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCreatorByUser } from "@/lib/creator";
import Link from "next/link";
import { acceptTermsAction, addChannelAction, deleteChannelAction, removeCreatorImageAction, updateProfileAction, updatePublicProfileAction, uploadCreatorImageAction } from "@/app/creator/actions";

export const dynamic = "force-dynamic";

const PLATFORMS = ["YouTube", "Twitch", "TikTok", "Facebook", "Instagram", "Kick", "Discord", "Other"];

export default async function CreatorSettings({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const user = (await getCurrentUser())!;
  const creator = (await getCreatorByUser(user.id))!;
  const channels = await prisma.creatorChannel.findMany({ where: { creatorId: creator.id }, orderBy: { id: "asc" } });
  return (
    <div>
      {msg && <p className="crt-badge green" style={{ display: "block", padding: "10px 14px", marginBottom: 12 }}>{msg}</p>}
      {err && <p className="crt-badge red" style={{ display: "block", padding: "10px 14px", marginBottom: 12 }}>{err}</p>}
      {!creator.agreementAt && (
        <div className="crt-card crt-form" style={{ borderColor: "#D97706", marginBottom: 14 }}>
          <h3>Chấp nhận điều khoản Affiliate</h3>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Tài khoản của bạn được chuyển tự động từ chương trình giới thiệu cũ. Chấp nhận Điều khoản đối tác Affiliate, Chính sách Affiliate, Chính sách hoa hồng, Chính sách thanh toán và Chính sách chống gian lận để mở tính năng rút tiền.</p>
          <form action={acceptTermsAction}>
            <label className="crt-agree" style={{ marginBottom: 12 }}>
              <input type="checkbox" name="agree" value="1" required />
              <span>Tôi đồng ý với Điều khoản đối tác Affiliate, Chính sách Affiliate, Chính sách hoa hồng, Chính sách thanh toán và Chính sách chống gian lận của BNTGame.</span>
            </label>
            <button className="btn btn-primary" type="submit">Chấp nhận điều khoản</button>
          </form>
        </div>
      )}
      <div className="crt-card crt-form">
        <h3>Trang cá nhân công khai</h3>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: -4 }}>
          Trang của bạn tại <Link href={`/creators/${creator.code}`} style={{ color: "var(--accent)", fontWeight: 600 }}>/creators/{creator.code}</Link> — khách thấy trang này từ mục Đồng hành cùng BNTGame.
        </p>
        <div className="crp-preview">
          <div className="crp-preview-cover" style={creator.coverUrl ? { backgroundImage: `url(${creator.coverUrl})` } : undefined} />
          {creator.avatarUrl
            ? <img className="crp-preview-ava" src={creator.avatarUrl} alt={creator.displayName} />
            : <span className="crp-preview-ava crp-preview-mono">{creator.displayName.slice(0, 2).toUpperCase()}</span>}
        </div>
        <div className="row">
          <form action={uploadCreatorImageAction} className="img-upload-box">
            <input type="hidden" name="kind" value="avatar" />
            <label>Ảnh đại diện (tối đa 2MB)</label>
            <input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/gif" />
            <button className="btn btn-outline btn-sm" type="submit">Tải ảnh đại diện</button>
            {creator.avatarUrl && <button className="btn btn-ghost btn-sm" type="submit" formAction={removeCreatorImageAction}>Gỡ ảnh</button>}
          </form>
          <form action={uploadCreatorImageAction} className="img-upload-box">
            <input type="hidden" name="kind" value="cover" />
            <label>Ảnh bìa (tối đa 5MB, nên dùng ảnh ngang)</label>
            <input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/gif" />
            <button className="btn btn-outline btn-sm" type="submit">Tải ảnh bìa</button>
            {creator.coverUrl && <button className="btn btn-ghost btn-sm" type="submit" formAction={removeCreatorImageAction}>Gỡ ảnh</button>}
          </form>
        </div>
        <form action={updatePublicProfileAction} style={{ marginTop: 14 }}>
          <div className="field"><label>Tên hiển thị</label><input name="displayName" defaultValue={creator.displayName} /></div>
          <div className="field"><label>Dòng giới thiệu ngắn</label><input name="headline" defaultValue={creator.headline} placeholder="Streamer Free Fire · Live mỗi tối 20h" maxLength={140} /></div>
          <div className="field"><label>Giới thiệu chi tiết</label><textarea name="bio" rows={4} defaultValue={creator.bio} placeholder="Viết vài dòng về bạn, lịch live, nội dung kênh..." maxLength={1200} /></div>
          <button className="btn btn-primary" type="submit">Lưu trang cá nhân</button>
        </form>
      </div>

      <div className="crt-card crt-form">
        <h3>Hồ sơ Affiliate</h3>
        <form action={updateProfileAction}>
          <div className="row">
            <div className="field"><label>Tên hiển thị</label><input name="displayName" defaultValue={creator.displayName} /></div>
            <div className="field"><label>Mã Affiliate (cố định)</label><input value={creator.code} disabled /></div>
          </div>
          <div className="row">
            <div className="field"><label>Quốc gia</label><input name="country" defaultValue={creator.country} /></div>
            <div className="field"><label>Ngôn ngữ</label><input name="language" defaultValue={creator.language} /></div>
          </div>
          <div className="row">
            <div className="field"><label>Kênh liên hệ</label><input name="contactMethod" defaultValue={creator.contactMethod} placeholder="Telegram / Discord / Email" /></div>
            <div className="field"><label>Thông tin liên hệ</label><input name="contactInfo" defaultValue={creator.contactInfo} /></div>
          </div>
          <button className="btn btn-primary" type="submit">Lưu hồ sơ</button>
        </form>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>
          Cấp hiện tại: <strong>{creator.level?.name ?? "Starter"}</strong> · Tỉ lệ hoa hồng: <strong>{((creator.customRateBps ?? creator.level?.rateBps ?? 0) / 100).toFixed(2).replace(/\.?0+$/, "")}%</strong>
          {creator.customRateBps != null && " (tỉ lệ riêng do BNTGame đặt)"} · Đã đồng ý điều khoản phiên bản {creator.agreementVersion || "—"}{creator.agreementAt ? ` vào ${creator.agreementAt.toLocaleDateString("vi-VN")}` : ""}.
        </p>
      </div>

      <h3 style={{ margin: "22px 0 10px" }}>Kênh truyền thông</h3>
      {channels.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 14 }}>
          <table className="crt-table">
            <thead><tr><th>Nền tảng</th><th>Kênh</th><th>Followers</th><th>Lượt xem TB</th><th></th></tr></thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id}>
                  <td>{c.platform}</td>
                  <td>{c.channelName}{c.url && <><br /><a href={c.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: 12.5 }}>{c.url}</a></>}</td>
                  <td>{c.followers.toLocaleString()}</td>
                  <td>{c.avgViews.toLocaleString()}</td>
                  <td><form action={deleteChannelAction}><input type="hidden" name="id" value={c.id} /><button className="btn btn-ghost btn-sm" type="submit">Xoá</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="crt-card crt-form">
        <h3>Thêm kênh</h3>
        <form action={addChannelAction}>
          <div className="row">
            <div className="field">
              <label>Nền tảng</label>
              <select name="platform">{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            </div>
            <div className="field"><label>Tên kênh</label><input name="channelName" /></div>
          </div>
          <div className="field"><label>URL kênh</label><input name="url" placeholder="https://youtube.com/@..." /></div>
          <div className="row">
            <div className="field"><label>Số người theo dõi</label><input name="followers" type="number" min="0" /></div>
            <div className="field"><label>Lượt xem trung bình</label><input name="avgViews" type="number" min="0" /></div>
          </div>
          <div className="row">
            <div className="field"><label>Danh mục nội dung</label><input name="category" /></div>
            <div className="field"><label>Quốc gia khán giả chính</label><input name="audienceCountry" /></div>
          </div>
          <button className="btn btn-primary" type="submit">Thêm kênh</button>
        </form>
      </div>
    </div>
  );
}
