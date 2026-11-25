import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../../ui";
import PrioritySelect from "../../PrioritySelect";
import { saveUidGuideAction, saveGameBannerAction, uploadGameBannerAction, saveGameMetaAction } from "../../actions";
import { parseUidGuide, guideToText } from "@/lib/guide";

export const dynamic = "force-dynamic";

const PRIORITIES = [
  ["ERIS", "Ưu tiên Eris (mặc định)"],
  ["FZR", "Ưu tiên FZR"],
  ["ERIS_ONLY", "Chỉ Eris"],
  ["FZR_ONLY", "Chỉ FZR"],
] as const;

const provLabel = (pv: string) => (pv === "MANUAL" ? "Tự thêm" : pv === "ERIS" ? "Đồng bộ · Eris" : "Đồng bộ · FZR");

export default async function AdminGameDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { id } = await params;
  const { msg, err } = await searchParams;
  const game = await prisma.game.findUnique({
    where: { id: Number(id) },
    include: { packages: { select: { provider: true, active: true, method: true } } },
  });
  if (!game) notFound();
  const providers = Array.from(new Set(game.packages.map((p) => p.provider)));
  const activePkgs = game.packages.filter((p) => p.active).length;
  const hasUid = game.packages.some((p) => /uid/i.test(p.method));
  const guideSteps = parseUidGuide(game.uidGuideJson);
  return (
    <div>
      <Top title={game.name}>
        <Link className="btn btn-outline btn-sm" href={`/game/${game.slug}`} target="_blank">Xem trang bán</Link>
        <Link className="btn btn-ghost btn-sm" href="/admin/games">← Danh sách game</Link>
      </Top>
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <img src={game.cover} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", border: "1px solid var(--aline)" }} />
          <div style={{ minWidth: 200 }}>
            <b style={{ fontSize: 17 }}>{game.name}</b>
            <div className="muted">{game.genre} · {game.packages.length} gói · Đã bán {game.soldCount.toLocaleString("vi-VN")} · ★ {game.ratingAvg.toFixed(1)} ({game.ratingCount.toLocaleString("vi-VN")})</div>
            <div className="muted">Nguồn đang có gói: {providers.map(provLabel).join(", ") || "chưa có"}</div>
            <form action={saveGameMetaAction} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 8 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Thể loại</label>
                <input name="genre" defaultValue={game.genre} placeholder="Chưa phân loại" style={{ width: 190 }} />
              </div>
              <input type="hidden" name="gameId" value={game.id} />
              <button className="btn btn-outline btn-sm" type="submit">Lưu thể loại</button>
            </form>
            <form action={saveGameMetaAction} style={{ marginTop: 14 }}>
              <div className="field" style={{ marginBottom: 8 }}>
                <label>Mô tả sản phẩm (hiện ở trang bán, để trống thì hệ thống tự lấy từ kho ứng dụng khi đồng bộ)</label>
                <textarea name="description" rows={5} defaultValue={game.description} placeholder="Giới thiệu game, cách nạp, lưu ý..." style={{ width: "100%", borderRadius: 10, border: "1px solid #D8DFEA", padding: "10px 12px", fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <input type="hidden" name="gameId" value={game.id} />
              <button className="btn btn-outline btn-sm" type="submit">Lưu mô tả</button>
            </form>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginLeft: "auto", flexWrap: "wrap" }}>
            <div className="field" style={{ minWidth: 230, marginBottom: 0 }}>
              <label>Chế độ nguồn của game (lưu ngay khi đổi)</label>
              <PrioritySelect gameId={game.id} initial={game.priority} />
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h2>Ảnh banner ngang</h2>
        <p className="muted" style={{ marginBottom: 12 }}>Ảnh ngang riêng cho dải banner trang chủ — KHÁC ảnh bìa/logo vuông. Game bán chạy mà chưa có ảnh banner thì sẽ không lên dải banner. Nên dùng ảnh ngang tỉ lệ khoảng 3.6:1.</p>
        {game.bannerUrl ? (
          <img src={game.bannerUrl} alt="" style={{ width: "100%", aspectRatio: "3.6/1", objectFit: "cover", borderRadius: 12, border: "1px solid var(--aline)", display: "block", marginBottom: 14 }} />
        ) : (
          <div style={{ border: "1.5px dashed #CBD5E1", borderRadius: 12, padding: "22px 16px", textAlign: "center", color: "#64748B", fontSize: 14, marginBottom: 14 }}>Chưa có ảnh banner</div>
        )}
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
          <form action={saveGameBannerAction} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", flex: "1 1 340px" }}>
            <input type="hidden" name="gameId" value={game.id} />
            <div className="field" style={{ flex: "1 1 220px", marginBottom: 0 }}>
              <label>Đường dẫn ảnh banner (URL hoặc /uploads/...)</label>
              <input name="bannerUrl" defaultValue={game.bannerUrl ?? ""} placeholder="https://… hoặc để trống để gỡ" />
            </div>
            <button className="btn btn-primary" type="submit">Lưu</button>
          </form>
          <form action={uploadGameBannerAction} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <input type="hidden" name="gameId" value={game.id} />
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Tải ảnh lên (PNG/JPG/WEBP, tối đa 4MB)</label>
              <input type="file" name="banner" accept="image/png,image/jpeg,image/webp" required />
            </div>
            <button className="btn btn-outline" type="submit">Tải lên</button>
          </form>
        </div>
      </div>
      <div className="admin-card">
        <h2>Hướng dẫn lấy UID</h2>
        {hasUid ? (
          <>
            <p className="muted" style={{ marginBottom: 10 }}>Mỗi dòng là một bước. Thêm ảnh cho bước bằng cách gõ thêm " | link ảnh" ở cuối dòng. Khách thấy nút hướng dẫn ở đầu trang game.</p>
            <form action={saveUidGuideAction}>
              <input type="hidden" name="gameId" value={game.id} />
              <div className="field">
                <textarea name="guide" rows={6} defaultValue={guideToText(guideSteps)} placeholder={"Mở game, vào mục Hồ sơ (Profile)\nChạm vào avatar ở góc trên bên trái\nUID là dãy số nằm dưới tên nhân vật | /covers/freefire.png"} style={{ width: "100%", borderRadius: 10, border: "1px solid #D8DFEA", padding: "10px 12px", fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <button className="btn btn-primary" type="submit">Lưu hướng dẫn</button>
            </form>
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Game này không có gói nạp bằng UID (chỉ nạp Login) nên trang bán không hiện nút hướng dẫn lấy UID.</p>
        )}
      </div>
      <div className="admin-card">
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 4px" }}>Gói nạp của game này</h2>
            <p className="muted" style={{ margin: 0 }}>{game.packages.length} gói · {activePkgs} đang bán. Gói có trang quản lý riêng: sửa giá hàng loạt, thêm gói, bật/tắt, làm tròn, xoá.</p>
          </div>
          <Link className="btn btn-accent" style={{ marginLeft: "auto" }} href={`/admin/games/${game.id}/packages`}>Mở quản lý gói</Link>
        </div>
      </div>
    </div>
  );
}
