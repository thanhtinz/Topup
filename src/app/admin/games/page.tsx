import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";
import { Top, Msg } from "../ui";
import { toggleGameAction } from "../actions";
import ToggleSwitch from "../ToggleSwitch";
import { dualSource } from "@/lib/visibility";
import EnrichButton from "./EnrichButton";
import { readEnrichState } from "@/lib/enrich";
import { readSyncState } from "@/lib/sync";
import SyncButton from "../providers/SyncButton";

export const dynamic = "force-dynamic";

export default async function AdminGames({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; q?: string }> }) {
  const { msg, err, q } = await searchParams;
  const enrichState = await readEnrichState();
  const allSync = await readSyncState("ALL");
  const games = await prisma.game.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    include: { packages: { orderBy: { priceCents: "asc" } } },
    orderBy: { soldCount: "desc" },
  });
  return (
    <div>
      <Top title="Quản lý game">
        <SyncButton code="ALL" initial={allSync} label="Đồng bộ nguồn" btnClass="btn btn-outline btn-sm" />
        <EnrichButton initial={enrichState} />
        <Link className="btn btn-accent btn-sm" href="/admin/games/new">+ Thêm sản phẩm</Link>
      </Top>
      <Msg msg={msg} err={err} />
      <form method="get" style={{ marginBottom: 16 }}>
        <div className="search" style={{ maxWidth: 420 }}>
          <input name="q" placeholder="Tìm game…" defaultValue={q ?? ""} style={{ flex: 1, border: 0, height: "100%", fontFamily: "inherit", fontSize: 15 }} />
        </div>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Game</th><th>Thể loại</th><th>Khu vực</th><th>Số gói</th><th>Giá từ</th><th>Đã bán</th><th>Trạng thái</th><th>Bật/Tắt</th><th></th></tr></thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.id}>
                <td>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={g.cover} alt="" style={{ width: 38, height: 38, borderRadius: 9, objectFit: "cover", border: "1px solid var(--aline)" }} />
                    <Link href={`/admin/games/${g.id}`} style={{ fontWeight: 600, color: "var(--aink)" }}>{g.name}</Link>
                  </span>
                </td>
                <td>{g.genre}</td>
                <td>{g.regions.length}</td>
                <td><Link href={`/admin/games/${g.id}/packages`} style={{ fontWeight: 600, color: "var(--ablue, #2456D6)" }}>{g.packages.length} gói</Link></td>
                <td>{g.packages[0] ? fmtUSD(g.packages[0].priceCents) : "—"}</td>
                <td>{g.soldCount}</td>
                <td>
                  <span className={`badge ${g.active ? "green" : "gray"}`}>{g.active ? "Đang bán" : "Đã tắt"}</span>
                  {g.active && !g.compareApproved && dualSource(g.packages.filter((p) => p.active).map((p) => p.provider)) && (
                    <span className="badge amber" style={{ marginLeft: 6 }}>Chờ duyệt so sánh · Đang ẩn</span>
                  )}
                </td>
                <td>
                  <ToggleSwitch action={toggleGameAction} name="id" value={String(g.id)} checked={g.active} label={g.active ? "Tắt game" : "Bật game"} />
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Link className="btn btn-accent btn-sm" href={`/admin/games/${g.id}/packages`}>Gói</Link>{" "}
                  <Link className="btn btn-outline btn-sm" href={`/admin/games/${g.id}`}>Chi tiết</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
