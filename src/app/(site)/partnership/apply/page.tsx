import Link from "next/link";
import { getActivePartnershipTypes, codeFromSlug } from "@/lib/partnership";
import { getCurrentUser } from "@/lib/auth";
import PartnershipApplyForm from "./ApplyForm";

export const dynamic = "force-dynamic";

export default async function PartnershipApplyPage({ searchParams }: { searchParams: Promise<{ sent?: string; id?: string; err?: string; type?: string }> }) {
  const { sent, id, err, type } = await searchParams;
  const [types, user] = await Promise.all([getActivePartnershipTypes(), getCurrentUser().catch(() => null)]);
  const preType = type ? (codeFromSlug(type) ?? type.toUpperCase()) : undefined;

  return (
    <div className="container" style={{ maxWidth: 860, paddingTop: 26, paddingBottom: 48 }}>
      <div className="crt-hero">
        <h1>Gửi hồ sơ hợp tác</h1>
        <p>Cho đội Partnership biết bạn là ai và muốn hợp tác theo hình thức nào. Không cần tài khoản — gửi hồ sơ trước, chúng tôi phản hồi qua email.</p>
        <div className="crt-steps">
          <span>1 · Chọn loại hình</span><span>2 · Liên hệ</span><span>3 · Kênh</span><span>4 · Đề xuất</span>
        </div>
      </div>

      {err && <p className="form-err" role="alert">{err}</p>}

      {sent ? (
        <div className="crt-card" style={{ textAlign: "center", padding: "34px 22px" }}>
          <h2 style={{ marginBottom: 8 }}>Đã nhận hồ sơ của bạn</h2>
          <p className="muted" style={{ maxWidth: 520, margin: "0 auto 16px" }}>
            Mã hồ sơ của bạn là <strong>#{id}</strong>. Đội Partnership BNTGame sẽ xem xét và phản hồi qua email bạn đã cung cấp.
            Nếu cần bổ sung thông tin, chúng tôi sẽ ghi rõ trong email phản hồi.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/partnership">Về trang Partnership</Link>
            <Link className="btn btn-outline" href="/">Về trang chủ</Link>
          </div>
        </div>
      ) : (
        <PartnershipApplyForm
          types={types.map((t) => ({ code: t.code, name: t.name, tagline: t.tagline }))}
          preType={preType}
          defaults={{ name: user?.name ?? "", email: user?.email ?? "" }}
        />
      )}
    </div>
  );
}
