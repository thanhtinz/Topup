import { prisma } from "@/lib/db";
import { Top, Msg } from "../../ui";
import { ensurePartnershipTypes, typeSlug } from "@/lib/partnership";
import { savePartnershipTypeAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminPartnershipTypes({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  await ensurePartnershipTypes();
  const types = await prisma.partnershipType.findMany({ orderBy: { sort: "asc" } });

  return (
    <div>
      <Top title="Partnership — Loại hình hợp tác" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <p className="muted" style={{ marginBottom: 12 }}>Loại hình đang bật sẽ hiện ở trang /partnership và trong form nộp hồ sơ. Tắt một loại hình chỉ ẩn khỏi bề mặt công khai, dữ liệu cũ giữ nguyên.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Loại hình</th><th>Mô tả ngắn</th><th>Mô tả chi tiết</th><th>Thứ tự</th><th>Đang bật</th><th></th></tr></thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id}>
                  <td colSpan={6}>
                    <form action={savePartnershipTypeAction} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <input type="hidden" name="id" value={t.id} />
                      <div style={{ flex: "0 0 170px" }}>
                        <input name="name" defaultValue={t.name} style={{ width: "100%" }} />
                        <span className="muted" style={{ fontSize: 12 }}>/partnership/{typeSlug(t.code)}</span>
                      </div>
                      <input name="tagline" defaultValue={t.tagline} style={{ flex: "1 1 180px" }} placeholder="Mô tả ngắn" />
                      <input name="description" defaultValue={t.description} style={{ flex: "2 1 240px" }} placeholder="Mô tả chi tiết" />
                      <input name="sort" type="number" defaultValue={t.sort} style={{ width: 64 }} />
                      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13.5 }}>
                        <input type="checkbox" name="isActive" value="1" defaultChecked={t.isActive} /> Bật
                      </label>
                      <button className="btn btn-dark btn-sm" type="submit">Lưu</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
