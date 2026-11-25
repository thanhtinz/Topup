import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCreatorByUser } from "@/lib/creator";
import { getSettings } from "@/lib/settings";
import { createLinkAction, deleteLinkAction, toggleLinkAction } from "@/app/creator/actions";
import CopyButton from "./CopyButton";

export const dynamic = "force-dynamic";

export default async function CreatorLinks({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const user = (await getCurrentUser())!;
  const creator = (await getCreatorByUser(user.id))!;
  const s = await getSettings();
  const base = (s.site_url || "https://bntgame.com").replace(/\/$/, "");
  const links = await prisma.creatorLink.findMany({ where: { creatorId: creator.id }, orderBy: { createdAt: "asc" } });
  const rows = await Promise.all(links.map(async (l) => {
    const clicks = await prisma.creatorClick.count({ where: { linkId: l.id } });
    return { l, clicks };
  }));
  const attributions = await prisma.creatorAttribution.groupBy({ by: ["linkId"], where: { creatorId: creator.id }, _count: true });
  const attrByLink = new Map(attributions.map((a) => [a.linkId, a._count]));

  return (
    <div>
      {msg && <p className="crt-badge green" style={{ display: "block", padding: "10px 14px", marginBottom: 12 }}>{msg}</p>}
      {err && <p className="crt-badge red" style={{ display: "block", padding: "10px 14px", marginBottom: 12 }}>{err}</p>}
      <div style={{ overflowX: "auto" }}>
        <table className="crt-table">
          <thead><tr><th>Tên link</th><th>Đường dẫn</th><th>Click</th><th>Khách ghi nhận</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {rows.map(({ l, clicks }) => (
              <tr key={l.id}>
                <td><strong>{l.name}</strong><br /><span style={{ color: "var(--muted)", fontSize: 12.5 }}>Đích: {l.destination}</span></td>
                <td><span className="crt-copy">{base}/ref/{l.code}<CopyButton text={`${base}/ref/${l.code}`} /></span></td>
                <td>{clicks}</td>
                <td>{attrByLink.get(l.id) ?? 0}</td>
                <td><span className={`crt-badge ${l.active ? "green" : "gray"}`}>{l.active ? "Đang chạy" : "Đã tắt"}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <form action={toggleLinkAction} style={{ display: "inline" }}><input type="hidden" name="id" value={l.id} /><button className="btn btn-outline btn-sm" type="submit">{l.active ? "Tắt" : "Bật"}</button></form>{" "}
                  {l.code !== creator.code && (
                    <form action={deleteLinkAction} style={{ display: "inline" }}><input type="hidden" name="id" value={l.id} /><button className="btn btn-ghost btn-sm" type="submit">Xoá</button></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="crt-card crt-form" style={{ marginTop: 18 }}>
        <h3>Tạo đường dẫn mới</h3>
        <form action={createLinkAction}>
          <div className="row">
            <div className="field"><label>Tên đường dẫn</label><input name="name" placeholder="Ví dụ: Link PUBG Mobile" /></div>
            <div className="field"><label>Hậu tố tuỳ chỉnh (tuỳ chọn)</label><input name="suffix" placeholder="pubg" /></div>
          </div>
          <div className="row">
            <div className="field">
              <label>Trang đích</label>
              <select name="destType">
                <option value="home">Trang chủ</option>
                <option value="games">Tất cả dịch vụ</option>
                <option value="game">Một game cụ thể</option>
              </select>
            </div>
            <div className="field"><label>Slug game (khi chọn game cụ thể)</label><input name="gameSlug" placeholder="free-fire" /></div>
          </div>
          <button className="btn btn-primary" type="submit">Tạo đường dẫn</button>
        </form>
      </div>
    </div>
  );
}
