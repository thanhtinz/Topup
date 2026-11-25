import { prisma } from "@/lib/db";
import { Top, Msg } from "../../../ui";
import { deleteMediaAction, saveMediaAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminCreatorMedia({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const assets = await prisma.creatorMediaAsset.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div>
      <Top title="Affiliate — Media Kit" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <h2>Thêm tài nguyên</h2>
        <form action={saveMediaAction}>
          <div className="form-grid">
            <div className="field"><label>Tiêu đề</label><input name="title" required /></div>
            <div className="field"><label>URL file</label><input name="fileUrl" required placeholder="https://..." /></div>
            <div className="field">
              <label>Loại</label>
              <select name="fileType"><option value="IMAGE">Ảnh</option><option value="VIDEO">Video</option><option value="FILE">File</option></select>
            </div>
            <div className="field"><label>Danh mục</label><input name="category" placeholder="Logo / Banner / Overlay" /></div>
          </div>
          <div className="field"><label>Mô tả</label><input name="description" /></div>
          <div className="form-actions"><button className="btn btn-dark" type="submit">Thêm tài nguyên</button></div>
        </form>
      </div>
      <div className="admin-card">
        <h2>Tài nguyên hiện có ({assets.length})</h2>
        {assets.length === 0 ? <p className="muted">Chưa có tài nguyên nào.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tiêu đề</th><th>Loại / Danh mục</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.title}</strong><br /><a href={a.fileUrl} target="_blank" rel="noreferrer" className="muted">{a.fileUrl}</a>{a.description && <><br /><span className="muted">{a.description}</span></>}</td>
                    <td>{a.fileType} / {a.category || "—"}</td>
                    <td>
                      <form action={saveMediaAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="title" value={a.title} />
                        <input type="hidden" name="fileUrl" value={a.fileUrl} />
                        <input type="hidden" name="fileType" value={a.fileType} />
                        <input type="hidden" name="category" value={a.category} />
                        <input type="hidden" name="description" value={a.description} />
                        <input type="hidden" name="active" value={a.active ? "0" : "1"} />
                        <button className="btn btn-outline btn-sm" type="submit">{a.active ? "Đang bật — bấm để tắt" : "Đang tắt — bấm để bật"}</button>
                      </form>
                    </td>
                    <td>
                      <form action={deleteMediaAction}><input type="hidden" name="id" value={a.id} /><button className="btn btn-ghost btn-sm" type="submit">Xoá</button></form>
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
