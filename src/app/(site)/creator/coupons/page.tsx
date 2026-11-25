import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCreatorByUser } from "@/lib/creator";

export const dynamic = "force-dynamic";

export default async function CreatorCoupons() {
  const user = (await getCurrentUser())!;
  const creator = (await getCreatorByUser(user.id))!;
  const coupons = await prisma.discountCode.findMany({ where: { creatorId: creator.id }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
        Mã giảm giá gắn riêng cho bạn do BNTGame cấp. Khách dùng mã của bạn khi thanh toán sẽ được ghi nhận doanh thu cho bạn theo quy tắc ưu tiên mã giảm giá.
      </p>
      {coupons.length === 0 ? (
        <div className="crt-card"><p>Bạn chưa có mã giảm giá riêng. Liên hệ BNTGame qua kênh hỗ trợ để được cấp mã.</p></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="crt-table">
            <thead><tr><th>Mã</th><th>Giảm</th><th>Đã dùng</th><th>Hạn dùng</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.code}</strong></td>
                  <td>{c.percent}%{c.maxDiscountCents ? ` (tối đa $${(c.maxDiscountCents / 100).toFixed(2)})` : ""}{c.minOrderCents ? ` · đơn từ $${(c.minOrderCents / 100).toFixed(2)}` : ""}</td>
                  <td>{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ""}</td>
                  <td>{c.expiresAt ? c.expiresAt.toLocaleDateString("vi-VN") : "Không hạn"}</td>
                  <td><span className={`crt-badge ${c.active ? "green" : "gray"}`}>{c.active ? "Đang chạy" : "Đã tắt"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
