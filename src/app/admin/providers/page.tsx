import Link from "next/link";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../ui";

export const dynamic = "force-dynamic";

export default async function AdminProviders({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const providers = await prisma.provider.findMany({ orderBy: { code: "asc" } });
  const stats = await Promise.all(
    providers.map(async (p) => {
      const pkgs = await prisma.package.count({ where: { provider: p.code } });
      const games = await prisma.game.count({ where: { packages: { some: { provider: p.code } } } });
      return { code: p.code, pkgs, games };
    }),
  );
  return (
    <div>
      <Top title="Nhà cung cấp" />
      <Msg msg={msg} err={err} />
      <p className="muted" style={{ marginBottom: 16 }}>Mỗi nguồn có nhà riêng: bấm vào nguồn để cấu hình API key, markup, kiểm tra số dư và đồng bộ — mọi thứ của nguồn đó nằm ở trang của nó.</p>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
        {providers.map((p) => {
          const st = stats.find((x) => x.code === p.code);
          return (
            <div className="stat-card" key={p.code} style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <b style={{ fontSize: 20 }}>{p.name}</b>
                <span className={`badge ${p.enabled ? "green" : "gray"}`}>{p.enabled ? "Đang bật" : "Đang tắt"}</span>
              </div>
              <div style={{ display: "grid", gap: 4, margin: "12px 0", fontSize: 14, color: "var(--ink-2)" }}>
                <span>Markup: <b style={{ color: "var(--ink)" }}>{p.markupPercent}%</b></span>
                <span>Game từ nguồn: <b style={{ color: "var(--ink)" }}>{st?.games ?? 0}</b> · Gói: <b style={{ color: "var(--ink)" }}>{st?.pkgs ?? 0}</b></span>
                <span>Khoá API: <b style={{ color: "var(--ink)" }}>{p.apiKeyEnc ? "Đã lưu (mã hoá)" : "Chưa có"}</b></span>
                <span>Đồng bộ gần nhất: <b style={{ color: "var(--ink)" }}>{p.lastSyncAt ? p.lastSyncAt.toLocaleString("vi-VN") : "chưa có"}</b></span>
              </div>
              <Link className="btn btn-primary btn-sm" href={`/admin/providers/${p.code}`}>Vào cấu hình nguồn</Link>
            </div>
          );
        })}
      </div>
      <p className="muted">Tên nhà cung cấp chỉ hiện trong admin — phía khách không bao giờ thấy tên nguồn.</p>
    </div>
  );
}
