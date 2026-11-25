import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../../../ui";
import ToggleSwitch from "../../../ToggleSwitch";
import { togglePackageAction, createPackageAction, saveAllPackagesAction, deletePackageAction } from "../../../actions";

export const dynamic = "force-dynamic";

const cellInput: React.CSSProperties = { height: 36, borderRadius: 9, border: "1px solid #D8DFEA", padding: "0 10px", fontFamily: "inherit", fontSize: 14, width: "100%", boxSizing: "border-box" };
const filterSel: React.CSSProperties = { height: 38, borderRadius: 10, border: "1px solid #D8DFEA", fontFamily: "inherit", padding: "0 10px", background: "#fff" };
const provLabel = (pv: string) => (pv === "MANUAL" ? "Tự thêm" : pv === "ERIS" ? "Đồng bộ · Eris" : "Đồng bộ · FZR");

export default async function AdminGamePackages({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string; prov?: string; region?: string }> }) {
  const { id } = await params;
  const { msg, err, prov, region } = await searchParams;
  const game = await prisma.game.findUnique({
    where: { id: Number(id) },
    include: { packages: { orderBy: [{ region: "asc" }, { method: "asc" }, { priceCents: "asc" }] } },
  });
  if (!game) notFound();
  const base = `/admin/games/${game.id}/packages`;
  const providers = Array.from(new Set(game.packages.map((p) => p.provider)));
  const regions = Array.from(new Set(game.packages.map((p) => p.region)));
  const visible = game.packages.filter((p) => (!prov || p.provider === prov) && (!region || p.region === region));
  const activeCount = game.packages.filter((p) => p.active).length;

  const fqParts = new URLSearchParams();
  if (prov) fqParts.set("prov", prov);
  if (region) fqParts.set("region", region);
  const fq = fqParts.toString();

  return (
    <div>
      <Top title={`Gói nạp — ${game.name}`}>
        <Link className="btn btn-outline btn-sm" href={`/admin/games/${game.id}`}>Chi tiết game</Link>
        <Link className="btn btn-ghost btn-sm" href="/admin/games">← Danh sách game</Link>
      </Top>
      <Msg msg={msg} err={err} />

      <div className="admin-card">
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <img src={game.cover} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: "cover", border: "1px solid var(--aline)" }} />
          <div>
            <b style={{ fontSize: 16 }}>{game.name}</b>
            <div className="muted">{game.packages.length} gói · {activeCount} đang bán · {regions.length} khu vực</div>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h2>Thêm gói tay</h2>
        <form action={createPackageAction} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
          <input type="hidden" name="gameId" value={game.id} />
          <input type="hidden" name="back" value={base} />
          <input type="hidden" name="fq" value={fq} />
          <div className="field"><label>Tên gói</label><input name="name" required /></div>
          <div className="field"><label>Ảnh gói (URL)</label><input name="image" placeholder="Để trống = dùng bìa game" /></div>
          <div className="field"><label>Khu vực</label><input name="region" defaultValue={game.regions[0] ?? "Global"} /></div>
          <div className="field"><label>Cách nạp</label><input name="method" defaultValue="UID" /></div>
          <div className="field"><label>Giá vốn (USD)</label><input name="cost" type="number" step="0.01" required /></div>
          <div className="field"><label>Giá bán (USD)</label><input name="price" type="number" step="0.01" required /></div>
          <div className="field"><label>Giá gốc NPH (USD)</label><input name="list" type="number" step="0.01" /></div>
          <div className="field" style={{ display: "flex", alignItems: "flex-end" }}><button className="btn btn-primary" type="submit">Thêm gói</button></div>
        </form>
      </div>

      <div className="admin-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Gói nạp ({visible.length}/{game.packages.length})</h2>
          <form method="get" style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
            <select name="prov" defaultValue={prov ?? ""} style={filterSel} aria-label="Lọc theo nguồn">
              <option value="">Mọi nguồn</option>
              {providers.map((pv) => <option key={pv} value={pv}>{provLabel(pv)}</option>)}
            </select>
            <select name="region" defaultValue={region ?? ""} style={filterSel} aria-label="Lọc theo khu vực">
              <option value="">Mọi khu vực</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button className="btn btn-outline btn-sm" type="submit">Lọc</button>
          </form>
        </div>
        <p className="muted" style={{ marginBottom: 10 }}>Sửa tên gói, ảnh gói và giá ngay trong bảng rồi bấm một nút Lưu tất cả ở cuối bảng.</p>

        <form id="bulkPkgs" action={saveAllPackagesAction}>
          <input type="hidden" name="gameId" value={game.id} />
          <input type="hidden" name="back" value={base} />
          <input type="hidden" name="fq" value={fq} />
          <input type="hidden" name="ids" value={visible.map((p) => p.id).join(",")} />
        </form>
        <div className="table-wrap table-compact">
          <table className="table-fixed">
            <colgroup>
              <col style={{ width: 300 }} /><col style={{ width: 104 }} /><col style={{ width: 56 }} />
              <col style={{ width: 92 }} /><col style={{ width: 92 }} /><col style={{ width: 104 }} />
              <col style={{ width: 92 }} /><col style={{ width: 52 }} /><col />
            </colgroup>
            <thead><tr><th>Gói</th><th>Khu vực</th><th>Cách nạp</th><th>Giá vốn $</th><th>Giá bán $</th><th>Giá gốc NPH $</th><th>Trạng thái</th><th>Bán</th><th></th></tr></thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id}>
                  <td style={{ whiteSpace: "normal" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <img src={p.imageUrl ?? game.cover} alt="" referrerPolicy="no-referrer" style={{ width: 40, height: 40, borderRadius: 9, objectFit: "cover", border: "1px solid var(--aline)", flex: "none", marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <input form="bulkPkgs" name={`name_${p.id}`} defaultValue={p.name} style={{ ...cellInput, fontWeight: 600 }} aria-label="Tên gói" />
                        <input form="bulkPkgs" name={`img_${p.id}`} defaultValue={p.imageUrl ?? ""} placeholder="Link ảnh gói (trống = bìa game)" style={{ ...cellInput, height: 30, fontSize: 12, marginTop: 6, color: "var(--aink2)" }} aria-label="Ảnh gói" />
                        <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <span className={`badge ${p.provider === "MANUAL" ? "gray" : "blue"}`}>{provLabel(p.provider)}</span>
                          {p.externalId && <span className="muted" style={{ fontSize: 12 }}>Mã nguồn: {p.externalId}</span>}
                          {p.stockNote && <span className="muted" style={{ fontSize: 12 }}>{p.stockNote}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{p.region}{p.method ? ` · ${p.method}` : ""}</td>
                  <td>{p.method}</td>
                  <td><input form="bulkPkgs" name={`cost_${p.id}`} type="number" step="0.01" min="0" defaultValue={(p.costCents / 100).toFixed(2)} style={cellInput} aria-label="Giá vốn" /></td>
                  <td><input form="bulkPkgs" name={`price_${p.id}`} type="number" step="0.01" min="0" defaultValue={(p.priceCents / 100).toFixed(2)} style={{ ...cellInput, fontWeight: 700 }} aria-label="Giá bán" /></td>
                  <td><input form="bulkPkgs" name={`list_${p.id}`} type="number" step="0.01" min="0" defaultValue={p.listPriceCents ? (p.listPriceCents / 100).toFixed(2) : ""} placeholder="—" style={cellInput} aria-label="Giá gốc nhà phát hành" /></td>
                  <td><span className={`badge ${p.active ? "green" : "gray"}`}>{p.active ? "Đang bán" : "Đã tắt"}</span></td>
                  <td>
                    <ToggleSwitch action={togglePackageAction} name="id" value={String(p.id)} checked={p.active} label={p.active ? "Tắt gói" : "Bật gói"} hidden={{ back: base, fq }} />
                  </td>
                  <td>
                    <form action={deletePackageAction} className="inline-form">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="back" value={base} />
                      <input type="hidden" name="fq" value={fq} />
                      <button className="btn btn-danger btn-sm" type="submit">Xoá</button>
                    </form>
                  </td>
                </tr>
              ))}
              {!visible.length && <tr><td colSpan={9} className="muted">Không có gói nào khớp bộ lọc.</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <button className="btn btn-accent" form="bulkPkgs" type="submit">Lưu tất cả thay đổi</button>
          <span className="muted">Đang áp cho {visible.length} gói trong bảng. Giá vốn của gói đồng bộ sẽ bị nguồn ghi lại ở lần đồng bộ sau.</span>
        </div>
      </div>
    </div>
  );
}
