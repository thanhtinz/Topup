import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";
import { Top, Msg } from "../../ui";
import { saveProviderAction, checkBalanceAction } from "../../actions";
import SyncButton from "../SyncButton";
import { readSyncState } from "@/lib/sync";

export const dynamic = "force-dynamic";

const META: Record<string, { title: string; note: string; keyLabel: string }> = {
  FZR: {
    title: "FZR.CARDS",
    note: "Nguồn nạp game qua API FZR.CARDS. Giá vốn USD, làm tròn lên cent sau markup. Tạo đơn có Idempotency-Key theo mã đơn.",
    keyLabel: "API key FZR",
  },
  ERIS: {
    title: "Eris (naperis.com)",
    note: "Nguồn nạp game ErisClone. Giá vốn VNĐ, quy đổi theo tỉ giá trung tâm ở mục Tiền tệ. Không có idempotency key: lỗi mơ hồ giữ đơn PENDING đối soát tay, không tự mua lại.",
    keyLabel: "API key Eris (x-api-key)",
  },
};

export default async function ProviderDetail({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { code } = await params;
  const { msg, err } = await searchParams;
  if (code !== "FZR" && code !== "ERIS") notFound();
  const p = await prisma.provider.findUnique({ where: { code } });
  const syncState = await readSyncState(code);
  if (!p) notFound();
  const meta = META[code];
  const [pkgCount, gameCount, recentPkgs] = await Promise.all([
    prisma.package.count({ where: { provider: code } }),
    prisma.game.count({ where: { packages: { some: { provider: code } } } }),
    prisma.package.findMany({
      where: { provider: code },
      include: { game: true },
      orderBy: { id: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div>
      <Top title={`Nguồn ${meta.title}`}>
        <Link className="btn btn-ghost btn-sm" href="/admin/providers">← Tất cả nhà cung cấp</Link>
      </Top>
      <Msg msg={msg} err={err} />

      <div className="stat-grid">
        <div className="stat-card"><b>{gameCount}</b><span>Game từ nguồn này</span></div>
        <div className="stat-card"><b>{pkgCount}</b><span>Gói từ nguồn này</span></div>
        <div className="stat-card"><b>{p.markupPercent}%</b><span>Markup đang áp</span></div>
        <div className="stat-card"><b>{p.lastSyncAt ? p.lastSyncAt.toLocaleString("vi-VN") : "—"}</b><span>Đồng bộ gần nhất</span></div>
      </div>

      <div className="admin-card">
        <h2>Cấu hình nguồn</h2>
        <p className="muted" style={{ marginBottom: 14 }}>{meta.note}</p>
        <form action={saveProviderAction} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          <input type="hidden" name="code" value={code} />
          <div className="field"><label>Base URL</label><input name="baseUrl" defaultValue={p.baseUrl} /></div>
          <div className="field"><label>{meta.keyLabel} (để trống = giữ khoá cũ)</label><input name="apiKey" type="password" autoComplete="off" placeholder={p.apiKeyEnc ? "Đã lưu (mã hoá)" : "Chưa có khoá"} /></div>
          <div className="field"><label>Markup (%)</label><input name="markup" type="number" step="0.1" min={0} defaultValue={p.markupPercent} /></div>
          <div className="field">
            <label>Trạng thái nguồn</label>
            <select name="enabled" defaultValue={p.enabled ? "1" : "0"}><option value="1">Bật</option><option value="0">Tắt</option></select>
          </div>
          <div className="field" style={{ display: "flex", alignItems: "flex-end" }}><button className="btn btn-primary" type="submit">Lưu cấu hình nguồn</button></div>
        </form>
      </div>

      <div className="admin-card">
        <h2>Số dư & đồng bộ</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <form action={checkBalanceAction} className="inline-form">
            <input type="hidden" name="code" value={code} />
            <button className="btn btn-outline" type="submit">Kiểm tra số dư</button>
          </form>
<SyncButton code={code} initial={syncState} />
        </div>
        <p className="muted" style={{ marginTop: 12 }}>Đồng bộ không tự bật lại game/gói đã tắt tay; gói không có giá bị chặn, không hiển thị phía khách. Chưa có khoá hoặc nguồn đang tắt thì đồng bộ dừng ngay.</p>
      </div>

      <div className="admin-card">
        <h2>Gói gần nhất từ nguồn này</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Game</th><th>Gói</th><th>Khu vực</th><th>Vốn</th><th>Bán</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {recentPkgs.map((pk) => (
                <tr key={pk.id}>
                  <td><Link href={`/admin/games/${pk.gameId}`} style={{ fontWeight: 600 }}>{pk.game.name}</Link></td>
                  <td>{pk.name}</td><td>{pk.region}</td><td>{fmtUSD(pk.costCents)}</td><td>{fmtUSD(pk.priceCents)}</td>
                  <td><span className={`badge ${pk.active ? "green" : "gray"}`}>{pk.active ? "Đang bán" : "Đã tắt"}</span></td>
                </tr>
              ))}
              {!recentPkgs.length && <tr><td colSpan={6} className="muted">Chưa có gói nào từ nguồn này — điền khoá, bật nguồn rồi bấm Đồng bộ.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
