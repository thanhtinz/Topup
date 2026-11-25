import Link from "next/link";
import { prisma } from "@/lib/db";
import { deletePostAction, savePostAction, togglePostAction } from "./actions";
import RichEditor from "./RichEditor";
import { isHtmlContent, plainTextToHtml } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const CAT: Record<string, string> = { TIN_TUC: "Tin tức", HUONG_DAN: "Hướng dẫn", SU_KIEN: "Sự kiện" };

export default async function AdminBlog({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; edit?: string }> }) {
  const sp = await searchParams;
  const posts = await prisma.post.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const editing = sp.edit ? posts.find((p) => p.id === Number(sp.edit)) : undefined;

  return (
    <div>
      <div className="admin-top-row"><h1>Blog & Tin tức</h1></div>
      <p className="muted" style={{ marginBottom: 16, maxWidth: 760 }}>Bài viết hiển thị ở trang /blog. Soạn nội dung bằng trình soạn thảo bên dưới (đậm/nghiêng, tiêu đề, danh sách, link, ảnh, căn lề). Chỉ bài đã xuất bản mới hiện phía khách.</p>
      {sp.msg && <p className="msg-ok">{sp.msg}</p>}
      {sp.err && <p className="msg-err">{sp.err}</p>}

      <div className="admin-card">
        <h2>{editing ? `Sửa bài: ${editing.title}` : "Viết bài mới"}</h2>
        <form action={savePostAction}>
          <input type="hidden" name="id" value={editing?.id ?? 0} />
          <div className="field"><label>Tiêu đề</label><input name="title" required defaultValue={editing?.title ?? ""} /></div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 240px" }}><label>Slug (trống = tự tạo từ tiêu đề)</label><input name="slug" defaultValue={editing?.slug ?? ""} placeholder="vd: huong-dan-nap-free-fire" /></div>
            <div className="field" style={{ width: 180 }}><label>Chuyên mục</label>
              <select name="category" defaultValue={editing?.category ?? "TIN_TUC"}>
                <option value="TIN_TUC">Tin tức</option>
                <option value="HUONG_DAN">Hướng dẫn</option>
                <option value="SU_KIEN">Sự kiện</option>
              </select></div>
          </div>
          <div className="field"><label>Ảnh bìa (URL, có thể trống)</label><input name="coverUrl" defaultValue={editing?.coverUrl ?? ""} placeholder="https://..." /></div>
          <div className="field"><label>Tóm tắt ngắn</label><input name="excerpt" defaultValue={editing?.excerpt ?? ""} maxLength={300} /></div>
          <div className="field"><label>Nội dung bài viết</label><RichEditor name="content" initialHtml={editing ? (isHtmlContent(editing.content) ? editing.content : plainTextToHtml(editing.content)) : ""} /></div>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14, marginBottom: 12 }}><input type="checkbox" name="published" value="1" defaultChecked={editing?.published ?? false} /> Xuất bản ngay</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-accent" type="submit">{editing ? "Lưu bài" : "Tạo bài"}</button>
            {editing && <Link className="btn btn-outline" href="/admin/blog">Huỷ sửa</Link>}
          </div>
        </form>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Tiêu đề</th><th>Chuyên mục</th><th>Trạng thái</th><th>Ngày đăng</th><th></th></tr></thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/blog/${p.slug}`}>{p.title}</Link><br /><span className="muted">/blog/{p.slug}</span></td>
                <td>{CAT[p.category] ?? p.category}</td>
                <td><span className={`badge ${p.published ? "green" : "gray"}`}>{p.published ? "Đã xuất bản" : "Bản nháp"}</span></td>
                <td>{p.publishedAt ? p.publishedAt.toLocaleDateString("vi-VN") : "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Link className="btn btn-outline btn-sm" href={`/admin/blog?edit=${p.id}`}>Sửa</Link>{" "}
                  <form action={togglePostAction} className="inline-form"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="published" value={p.published ? "0" : "1"} /><button className="btn btn-ghost btn-sm" type="submit">{p.published ? "Gỡ xuống" : "Xuất bản"}</button></form>{" "}
                  <form action={deletePostAction} className="inline-form"><input type="hidden" name="id" value={p.id} /><button className="btn btn-danger btn-sm" type="submit">Xoá</button></form>
                </td>
              </tr>
            ))}
            {posts.length === 0 && <tr><td colSpan={5} className="muted">Chưa có bài viết nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
