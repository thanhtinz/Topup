import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { creatorConfig } from "@/lib/creator";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = { VERIFIED: "Đã xác thực", OFFICIAL: "Đối tác chính thức", CREATOR: "" };
const GRADIENTS = [
  "linear-gradient(135deg,#0B63E5,#1FB6F2)",
  "linear-gradient(135deg,#7C3AED,#C084FC)",
  "linear-gradient(135deg,#EA580C,#F59E0B)",
  "linear-gradient(135deg,#059669,#34D399)",
  "linear-gradient(135deg,#DB2777,#F472B6)",
  "linear-gradient(135deg,#0F766E,#2DD4BF)",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PLATFORM_COLORS: Record<string, string> = {
  YouTube: "#FF0033", TikTok: "#161823", Twitch: "#9146FF", Facebook: "#1877F2",
  Instagram: "#E1306C", Kick: "#00C853", Discord: "#5865F2", Other: "#64748B",
};

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export default async function CreatorProfile({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cfg = await creatorConfig();
  if (!cfg.enabled) notFound();
  const creator = await prisma.creator.findFirst({
    where: { code: { equals: code, mode: "insensitive" }, status: "ACTIVE" },
    include: { level: true, channels: { orderBy: { id: "asc" } } },
  });
  if (!creator) notFound();

  const totalFollowers = creator.channels.reduce((s, c) => s + (c.followers || 0), 0);
  const memberSince = `Tháng ${creator.createdAt.getMonth() + 1}/${creator.createdAt.getFullYear()}`;
  const grad = GRADIENTS[creator.id % GRADIENTS.length];

  return (
    <div className="container" style={{ paddingBottom: 44, maxWidth: 860 }}>
      <div className="crp-card">
        <div className="crp-cover" style={creator.coverUrl ? { backgroundImage: `url(${creator.coverUrl})` } : { background: grad }} />
        <div className="crp-head">
          {creator.avatarUrl
            ? <img className="crp-ava" src={creator.avatarUrl} alt={creator.displayName} />
            : <span className="crp-ava crp-mono" style={{ background: grad }}>{initials(creator.displayName)}</span>}
          <div className="crp-title">
            <h1>{creator.displayName}</h1>
            <div className="crp-badges">
              {TIER_LABEL[creator.tier] && <span className="crt-badge blue">{TIER_LABEL[creator.tier]}</span>}
              <span className="crt-badge green">Affiliate BNTGame</span>
            </div>
            {creator.headline && <p className="crp-headline">{creator.headline}</p>}
          </div>
        </div>
        <div className="crp-stats">
          <div><strong>{fmtCount(totalFollowers)}</strong><span>Người theo dõi</span></div>
          <div><strong>{creator.channels.length}</strong><span>Kênh</span></div>
          <div><strong>{memberSince}</strong><span>Đồng hành từ</span></div>
        </div>
        {creator.bio && (
          <div className="crp-bio">
            <h3>Giới thiệu</h3>
            {creator.bio.split(/\n+/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        )}
        {(creator.country || creator.language) && (
          <p className="crp-meta">
            {[creator.country, creator.language].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {creator.channels.length > 0 && (
        <>
          <h2 className="crp-h2">Kênh của {creator.displayName}</h2>
          <div className="crp-channels">
            {creator.channels.map((ch) => (
              <div key={ch.id} className="crp-chan">
                <div className="crp-chan-left">
                  <span className="crp-picon" style={{ background: PLATFORM_COLORS[ch.platform] ?? "#64748B" }}>{ch.platform.slice(0, 1)}</span>
                  <div className="crp-chan-main">
                    <strong>{ch.platform}</strong>
                    <span>{ch.channelName || "—"}</span>
                    {ch.category && <span className="crp-chan-cat">{ch.category}</span>}
                  </div>
                </div>
                <div className="crp-chan-side">
                  {ch.followers > 0 && <span>{fmtCount(ch.followers)} theo dõi</span>}
                  {ch.url && <a className="btn btn-primary btn-sm" href={ch.url.startsWith("http") ? ch.url : `https://${ch.url}`} target="_blank" rel="noreferrer">Xem kênh</a>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="crp-cta">
        <h3>Nạp game qua link của {creator.displayName}</h3>
        <p>Mua qua link giới thiệu để ủng hộ {creator.displayName} — giá và ưu đãi của bạn không đổi.</p>
        <a className="btn" href={`/ref/${creator.code}`}>Đến cửa hàng qua link của {creator.displayName}</a>
      </div>

    </div>
  );
}
