import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCreatorByUser } from "@/lib/creator";
import { joinCampaignAction } from "@/app/creator/actions";

export const dynamic = "force-dynamic";

export default async function CreatorCampaigns({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const user = (await getCurrentUser())!;
  const creator = (await getCreatorByUser(user.id))!;
  const campaigns = await prisma.creatorCampaign.findMany({
    where: { status: { in: ["ACTIVE", "DRAFT"] } },
    orderBy: { startAt: "desc" },
    include: { joins: { where: { creatorId: creator.id } } },
  });
  return (
    <div>
      {msg && <p className="crt-badge green" style={{ display: "block", padding: "10px 14px", marginBottom: 12 }}>{msg}</p>}
      {err && <p className="crt-badge red" style={{ display: "block", padding: "10px 14px", marginBottom: 12 }}>{err}</p>}
      {campaigns.length === 0 ? (
        <div className="crt-card"><p>Hiện chưa có chiến dịch nào đang mở. BNTGame sẽ thông báo khi có chiến dịch mới.</p></div>
      ) : (
        <div className="crt-grid">
          {campaigns.map((c) => {
            const join = c.joins[0];
            const live = c.status === "ACTIVE" && c.startAt <= new Date() && c.endAt >= new Date();
            return (
              <div key={c.id} className="crt-card">
                {c.bannerUrl && <img src={c.bannerUrl} alt="" style={{ width: "100%", borderRadius: 12, marginBottom: 10 }} referrerPolicy="no-referrer" />}
                <h3>{c.name}</h3>
                <p>{c.description || "Chiến dịch quảng bá của BNTGame."}</p>
                <p style={{ marginTop: 8 }}>
                  <span className="crt-badge gold">Bonus +{(c.bonusBps / 100).toFixed(2).replace(/\.?0+$/, "")}% hoa hồng</span>{" "}
                  <span className="crt-badge gray">{c.startAt.toLocaleDateString("vi-VN")} → {c.endAt.toLocaleDateString("vi-VN")}</span>
                </p>
                <div style={{ marginTop: 12 }}>
                  {join ? (
                    <span className={`crt-badge ${join.status === "APPROVED" ? "green" : join.status === "REJECTED" ? "red" : "gray"}`}>
                      {join.status === "APPROVED" ? "Đã tham gia" : join.status === "REJECTED" ? "Bị từ chối" : "Đang chờ duyệt"}
                    </span>
                  ) : live ? (
                    <form action={joinCampaignAction}>
                      <input type="hidden" name="campaignId" value={c.id} />
                      <button className="btn btn-primary btn-sm" type="submit">Đăng ký tham gia</button>
                    </form>
                  ) : (
                    <span className="crt-badge gray">Sắp diễn ra</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
