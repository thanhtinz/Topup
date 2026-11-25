import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../../../ui";
import { addAdjustmentAction, createCreatorCouponAction, toggleCouponAction, updateCreatorAction } from "../actions";
import { creatorBalances, creatorRevenue30d } from "@/lib/creator";
import { fmtUSD } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminCreatorDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { id } = await params;
  const { msg, err } = await searchParams;
  const creator = await prisma.creator.findUnique({
    where: { id: Number(id) },
    include: { level: true, user: { select: { email: true, name: true, createdAt: true } }, channels: true, links: true },
  });
  if (!creator) notFound();
  const [levels, bal, revenue30, coupons, commissions, payouts, adjustments, clicks] = await Promise.all([
    prisma.creatorLevel.findMany({ orderBy: { sort: "asc" } }),
    creatorBalances(creator.id),
    creatorRevenue30d(creator.id),
    prisma.discountCode.findMany({ where: { creatorId: creator.id }, orderBy: { createdAt: "desc" } }),
    prisma.creatorCommission.findMany({ where: { creatorId: creator.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.creatorPayout.findMany({ where: { creatorId: creator.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.creatorAdjustment.findMany({ where: { creatorId: creator.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.creatorClick.count({ where: { creatorId: creator.id } }),
  ]);

  return (
    <div>
      <Top title={`Creator: ${creator.displayName}`} />
      <Msg msg={msg} err={err} />
      <p style={{ marginBottom: 12 }}><Link href="/admin/partnership/affiliate">← Tất cả Affiliate</Link></p>

      <div className="stat-grid">
        <div className="stat-card"><span>Doanh thu 30 ngày</span><strong>{fmtUSD(revenue30)}</strong></div>
        <div className="stat-card"><span>Hoa hồng chờ</span><strong>{fmtUSD(bal.pendingCents)}</strong></div>
        <div className="stat-card"><span>Có thể rút</span><strong>{fmtUSD(bal.availableCents)}</strong></div>
        <div className="stat-card"><span>Đang khoá rút</span><strong>{fmtUSD(bal.lockedCents)}</strong></div>
        <div className="stat-card"><span>Đã thanh toán</span><strong>{fmtUSD(bal.paidOutCents)}</strong></div>
        <div className="stat-card"><span>Tổng click</span><strong>{clicks}</strong></div>
      </div>

      <div className="admin-card">
        <h2>Thông tin & phân quyền</h2>
        <p className="muted" style={{ marginBottom: 10 }}>
          Mã: <strong>{creator.code}</strong> · Link: /ref/{creator.code} · Tài khoản: {creator.user.email} (từ {creator.user.createdAt.toLocaleDateString("vi-VN")}) ·
          Đồng ý điều khoản v{creator.agreementVersion || "—"}{creator.agreementAt ? ` ngày ${creator.agreementAt.toLocaleDateString("vi-VN")}` : ""}
        </p>
        <form action={updateCreatorAction}>
          <input type="hidden" name="id" value={creator.id} />
          <div className="form-grid">
            <div className="field"><label>Tên hiển thị</label><input name="displayName" defaultValue={creator.displayName} /></div>
            <div className="field">
              <label>Cấp độ</label>
              <select name="levelId" defaultValue={creator.levelId ?? ""}>
                <option value="">— Chưa gán —</option>
                {levels.map((l) => <option key={l.id} value={l.id}>{l.name} ({(l.rateBps / 100).toFixed(2)}%)</option>)}
              </select>
            </div>
            <div className="field"><label>Tỉ lệ riêng % (trống = theo cấp)</label><input name="customRate" type="number" step="0.01" min="0" max="100" defaultValue={creator.customRateBps != null ? (creator.customRateBps / 100).toFixed(2) : ""} /></div>
            <div className="field">
              <label>Hạng đối tác</label>
              <select name="tier" defaultValue={creator.tier}>
                <option value="CREATOR">Affiliate</option>
                <option value="VERIFIED">Verified Creator</option>
                <option value="OFFICIAL">Official Partner</option>
              </select>
            </div>
            <div className="field">
              <label>Trạng thái</label>
              <select name="status" defaultValue={creator.status}>
                <option value="ACTIVE">Hoạt động</option>
                <option value="SUSPENDED">Tạm khóa</option>
              </select>
            </div>
          </div>
          <div className="form-actions"><button className="btn btn-dark" type="submit">Lưu Creator</button></div>
        </form>
        {creator.channels.length > 0 && (
          <p className="muted" style={{ marginTop: 10 }}>
            Kênh: {creator.channels.map((c) => `${c.platform}: ${c.channelName || c.url} (${c.followers.toLocaleString()})`).join(" · ")}
          </p>
        )}
        <p className="muted">Link phụ: {creator.links.filter((l) => l.code !== creator.code).map((l) => `/ref/${l.code}`).join(", ") || "—"}</p>
      </div>

      <div className="admin-card">
        <h2>Mã giảm giá riêng</h2>
        {coupons.length > 0 && (
          <div className="table-wrap" style={{ marginBottom: 12 }}>
            <table>
              <thead><tr><th>Mã</th><th>Giảm</th><th>Đã dùng</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.code}</strong></td>
                    <td>{c.percent}%{c.maxDiscountCents ? ` (tối đa ${fmtUSD(c.maxDiscountCents)})` : ""}{c.minOrderCents ? ` · đơn từ ${fmtUSD(c.minOrderCents)}` : ""}</td>
                    <td>{c.usedCount}{c.maxUses ? `/${c.maxUses}` : ""}</td>
                    <td>{c.active ? "Đang chạy" : "Đã tắt"}</td>
                    <td>
                      <form action={toggleCouponAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="creatorId" value={creator.id} />
                        <button className="btn btn-outline btn-sm" type="submit">{c.active ? "Tắt mã" : "Bật mã"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form action={createCreatorCouponAction}>
          <input type="hidden" name="creatorId" value={creator.id} />
          <div className="form-grid">
            <div className="field"><label>Mã (viết hoa)</label><input name="code" required placeholder="ALEX5" /></div>
            <div className="field"><label>Giảm %</label><input name="percent" type="number" min="1" max="90" required /></div>
            <div className="field"><label>Trần giảm (USD, trống = không trần)</label><input name="maxDiscount" type="number" step="0.01" min="0" /></div>
            <div className="field"><label>Đơn tối thiểu (USD)</label><input name="minOrder" type="number" step="0.01" min="0" /></div>
            <div className="field"><label>Tổng lượt dùng (trống = không giới hạn)</label><input name="maxUses" type="number" min="0" /></div>
            <div className="field"><label>Hạn dùng</label><input name="expiresAt" type="date" /></div>
          </div>
          <div className="form-actions"><button className="btn btn-dark" type="submit">Tạo mã cho Creator</button></div>
        </form>
      </div>

      <div className="admin-card">
        <h2>Điều chỉnh số dư</h2>
        <form action={addAdjustmentAction} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <input type="hidden" name="creatorId" value={creator.id} />
          <div className="field"><label>Số tiền USD (+ cộng / − trừ)</label><input name="amount" type="number" step="0.01" required /></div>
          <div className="field" style={{ flex: "1 1 240px" }}><label>Lý do (bắt buộc, vào audit)</label><input name="reason" required /></div>
          <button className="btn btn-dark" type="submit">Ghi điều chỉnh</button>
        </form>
        {adjustments.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead><tr><th>Ngày</th><th>Số tiền</th><th>Lý do</th></tr></thead>
              <tbody>{adjustments.map((a) => (<tr key={a.id}><td>{a.createdAt.toLocaleDateString("vi-VN")}</td><td>{a.amountCents > 0 ? "+" : ""}{fmtUSD(a.amountCents)}</td><td>{a.reason}</td></tr>))}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-card">
        <h2>Hoa hồng gần nhất</h2>
        {commissions.length === 0 ? <p className="muted">Chưa có khoản nào.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Đơn</th><th>Ngày</th><th>Doanh thu tính</th><th>Tỉ lệ</th><th>Hoa hồng</th><th>Trạng thái</th></tr></thead>
              <tbody>{commissions.map((c) => (<tr key={c.id}><td>{c.orderCode}</td><td>{c.createdAt.toLocaleDateString("vi-VN")}</td><td>{fmtUSD(c.eligibleCents)}</td><td>{(c.rateBps / 100).toFixed(2)}%</td><td>{fmtUSD(c.amountCents)}</td><td>{c.status}</td></tr>))}</tbody>
            </table>
          </div>
        )}
        <p style={{ marginTop: 10 }}><Link href="/admin/partnership/affiliate/commissions">Xem toàn bộ hoa hồng →</Link></p>
      </div>

      <div className="admin-card">
        <h2>Rút tiền gần nhất</h2>
        {payouts.length === 0 ? <p className="muted">Chưa có yêu cầu nào.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Ngày</th><th>Số tiền</th><th>Phương thức</th><th>Trạng thái</th><th>TxRef</th></tr></thead>
              <tbody>{payouts.map((p) => (<tr key={p.id}><td>{p.createdAt.toLocaleDateString("vi-VN")}</td><td>{fmtUSD(p.amountCents)}</td><td>{p.method}</td><td>{p.status}</td><td>{p.txRef || "—"}</td></tr>))}</tbody>
            </table>
          </div>
        )}
        <p style={{ marginTop: 10 }}><Link href="/admin/partnership/affiliate/payouts">Tới hàng đợi rút tiền →</Link></p>
      </div>
    </div>
  );
}
