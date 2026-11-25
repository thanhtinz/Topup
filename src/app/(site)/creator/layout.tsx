import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCreatorByUser } from "@/lib/creator";
import CreatorNav from "./CreatorNav";

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=login");
  const creator = await getCreatorByUser(user.id);
  if (!creator) redirect("/partnership/apply?type=affiliate");
  const initials = creator.displayName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return (
    <div className="container" style={{ paddingBottom: 40 }}>
      <div className="crt-id">
        {creator.avatarUrl
          ? <img className="ava" src={creator.avatarUrl} alt={creator.displayName} />
          : <span className="mono">{initials}</span>}
        <div className="who">
          <div className="nm">{creator.displayName}</div>
          <div className="meta">
            <span className="chip solid">Cấp {creator.level?.name ?? "Starter"}</span>
            {creator.tier === "VERIFIED" && <span className="chip">Đã xác thực</span>}
            {creator.tier === "OFFICIAL" && <span className="chip">Đối tác chính thức</span>}
            <span className="chip">Mã: {creator.code}</span>
            {creator.status !== "ACTIVE" && <span className="chip" style={{ background: "#D33", borderColor: "#D33" }}>Đang bị tạm khóa</span>}
          </div>
        </div>
        <div className="acts">
          <Link className="primary" href={`/creators/${creator.code}`}>Trang cá nhân</Link>
          <Link href="/creators">Chương trình Affiliate</Link>
        </div>
      </div>
      <CreatorNav />
      {!creator.agreementAt && (
        <div className="crt-card" style={{ borderColor: "#D97706", marginBottom: 14 }}>
          <h3 style={{ color: "#B45309" }}>Cần chấp nhận điều khoản Affiliate</h3>
          <p>Tài khoản của bạn được chuyển từ chương trình giới thiệu cũ. Bạn vẫn nhận hoa hồng bình thường, nhưng cần chấp nhận điều khoản Affiliate mới trước khi rút tiền — thực hiện ở mục Hồ sơ.</p>
        </div>
      )}
      {children}
    </div>
  );
}
