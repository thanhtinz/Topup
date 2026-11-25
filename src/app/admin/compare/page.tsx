import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";
import { Top, Msg } from "../ui";
import CompareControls from "./CompareControls";

export const dynamic = "force-dynamic";

type Side = { count: number; minCost: number | null };
function side(pkgs: { provider: string; costCents: number }[], code: string): Side {
  const list = pkgs.filter((p) => p.provider === code);
  return { count: list.length, minCost: list.length ? Math.min(...list.map((p) => p.costCents)) : null };
}

export default async function AdminCompare({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const games = await prisma.game.findMany({
    include: { packages: { where: { active: true, provider: { in: ["FZR", "ERIS"] } }, select: { provider: true, costCents: true } } },
    orderBy: { soldCount: "desc" },
  });
  const rows = games.map((g) => ({ g, fzr: side(g.packages, "FZR"), eris: side(g.packages, "ERIS") }));
  const both = rows.filter((r) => r.fzr.count > 0 && r.eris.count > 0);
  const onlyFzr = rows.filter((r) => r.fzr.count > 0 && r.eris.count === 0).length;
  const onlyEris = rows.filter((r) => r.eris.count > 0 && r.fzr.count === 0).length;

  return (
    <div>
      <Top title="So sánh giá 2 nguồn" />
      <Msg msg={msg} err={err} />
      <div className="stat-grid">
        <div className="stat-card"><span className="stat-ico"><b style={{ fontSize: 17 }}>2</b></span><b>{both.length}</b><span>Game có ở cả 2 nguồn</span></div>
        <div className="stat-card"><span className="stat-ico"><b style={{ fontSize: 17 }}>F</b></span><b>{onlyFzr}</b><span>Game chỉ có ở FZR</span></div>
        <div className="stat-card"><span className="stat-ico"><b style={{ fontSize: 17 }}>E</b></span><b>{onlyEris}</b><span>Game chỉ có ở Eris</span></div>
      </div>
      <div className="admin-card">
        <h2>Game có ở cả 2 nguồn</h2>
        <p className="muted" style={{ marginBottom: 12 }}>So giá vốn rẻ nhất của từng nguồn theo từng game. Game chưa duyệt ở trang này thì ẨN phía khách — bấm Duyệt mới hiện. Nguồn được chọn hết hàng thì đơn tự lùi về nguồn còn lại (trừ chế độ Chỉ một nguồn).</p>
        <div className="table-wrap">
          <table style={{ minWidth: 1180 }}>
            <colgroup>
              <col style={{ width: 230 }} /><col style={{ width: 215 }} /><col style={{ width: 215 }} />
              <col style={{ width: 100 }} /><col style={{ width: 195 }} /><col style={{ width: 165 }} /><col />
            </colgroup>
            <thead><tr><th>Game</th><th>FZR.CARDS</th><th>Eris</th><th>Chênh lệch</th><th>Chế độ nguồn</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {both.map(({ g, fzr, eris }) => {
                const f = fzr.minCost ?? 0, e = eris.minCost ?? 0;
                const cheaper = f === e ? null : f < e ? "FZR" : "ERIS";
                return (
                  <tr key={g.id}>
                    <td style={{ whiteSpace: "normal" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img src={g.cover} alt="" style={{ width: 38, height: 38, borderRadius: 9, objectFit: "cover", border: "1px solid var(--aline)", flex: "none" }} />
                        <Link href={`/admin/games/${g.id}`} style={{ fontWeight: 600, color: "var(--aink)", whiteSpace: "normal", lineHeight: 1.35 }}>{g.name}</Link>
                      </span>
                    </td>
                    <td>
                      <b>{fmtUSD(f)}</b> <span className="muted">· {fzr.count} gói</span>
                      {cheaper === "FZR" && <span className="badge green" style={{ marginLeft: 8 }}>Giá gốc rẻ hơn</span>}
                    </td>
                    <td>
                      <b>{fmtUSD(e)}</b> <span className="muted">· {eris.count} gói</span>
                      {cheaper === "ERIS" && <span className="badge green" style={{ marginLeft: 8 }}>Giá gốc rẻ hơn</span>}
                    </td>
                    <td>{f === e ? <span className="muted">Ngang nhau</span> : <b>{fmtUSD(Math.abs(f - e))}</b>}</td>
                    <CompareControls gameId={g.id} initialPriority={g.priority} initialApproved={g.compareApproved} />
                    <td><Link className="btn btn-ghost btn-sm" href={`/admin/games/${g.id}/packages`}>Xem gói</Link></td>
                  </tr>
                );
              })}
              {!both.length && <tr><td colSpan={7} className="muted">Chưa có game nào có gói ở cả 2 nguồn. Đồng bộ FZR và Eris ở Quản lý game rồi quay lại đây.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
