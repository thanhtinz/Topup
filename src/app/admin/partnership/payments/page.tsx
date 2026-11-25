import Link from "next/link";
import { prisma } from "@/lib/db";
import { Top, Msg } from "../../ui";
import { PAYMENT_STATUS, PAYMENT_TYPE, partnershipPaymentMethods } from "@/lib/partnership";
import { fmtUSD } from "@/lib/money";
import { savePartnerPaymentAction, partnerPaymentFlowAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminPartnerPayments({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; status?: string }> }) {
  const { msg, err, status } = await searchParams;
  const methods = await partnershipPaymentMethods();
  const [payments, partners, campaigns] = await Promise.all([
    prisma.partnerPayment.findMany({
      where: { status: status || undefined },
      orderBy: { createdAt: "desc" }, take: 100,
      include: { partner: { select: { id: true, displayName: true } }, campaign: { select: { name: true, code: true } } },
    }),
    prisma.partner.findMany({ where: { status: "ACTIVE" }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true } }),
    prisma.partnerCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, name: true, code: true } }),
  ]);
  const totals = await prisma.partnerPayment.groupBy({ by: ["status"], _sum: { amountCents: true } });
  const sumOf = (s: string) => totals.find((t) => t.status === s)?._sum.amountCents ?? 0;

  return (
    <div>
      <Top title="Partnership — Thanh toán" />
      <Msg msg={msg} err={err} />
      <div className="stat-grid">
        <div className="stat-card"><span>Chờ phê duyệt (USD)</span><strong>{fmtUSD(sumOf("PENDING_APPROVAL"))}</strong></div>
        <div className="stat-card"><span>Đã duyệt, chưa trả (USD)</span><strong>{fmtUSD(sumOf("APPROVED") + sumOf("PROCESSING"))}</strong></div>
        <div className="stat-card"><span>Đã trả (USD)</span><strong>{fmtUSD(sumOf("PAID"))}</strong></div>
      </div>
      <p className="muted" style={{ marginBottom: 12 }}>Khoản chi Partnership tách bạch hoàn toàn với hoa hồng Affiliate. Người tạo khoản chi không tự phê duyệt khi còn admin khác. Đánh dấu ĐÃ TRẢ bắt buộc nhập mã giao dịch/chứng từ.</p>
      <div className="admin-card">
        <h2 style={{ marginBottom: 10 }}>Tạo khoản chi</h2>
        <form action={savePartnerPaymentAction} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select name="partnerId" required style={{ height: 38, flex: "1 1 180px" }}>
            <option value="">Chọn Partner...</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
          <select name="campaignId" style={{ height: 38, flex: "1 1 180px" }}>
            <option value="">Không gắn chiến dịch</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
          <input name="amount" type="number" step="0.01" min="0.01" required placeholder="Số tiền (USD)" style={{ width: 140 }} />
          <select name="type" style={{ height: 38 }}>
            {Object.entries(PAYMENT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="method" style={{ height: 38 }}>
            <option value="">Cách trả...</option>
            {methods.map((m) => <option key={m} value={m}>{m === "BANK" ? "Chuyển khoản ngân hàng" : m}</option>)}
          </select>
          <input name="dueAt" type="date" title="Hạn thanh toán" style={{ width: 160 }} />
          <input name="note" placeholder="Ghi chú khoản chi" style={{ flex: "2 1 200px" }} />
          <button className="btn btn-dark btn-sm" type="submit">Tạo khoản chi</button>
        </form>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Link className={`btn btn-sm ${!status ? "btn-dark" : "btn-outline"}`} href="/admin/partnership/payments">Tất cả</Link>
        {Object.entries(PAYMENT_STATUS).map(([k, v]) => (
          <Link key={k} className={`btn btn-sm ${status === k ? "btn-dark" : "btn-outline"}`} href={`/admin/partnership/payments?status=${k}`}>{v}</Link>
        ))}
      </div>
      <div className="admin-card">
        {payments.length === 0 ? <p className="muted">Chưa có khoản chi nào.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Khoản chi</th><th>Partner</th><th>Số tiền</th><th>Loại / cách trả</th><th>Trạng thái</th><th style={{ minWidth: 300 }}>Thao tác</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td><strong>#{p.id}</strong> {p.note}<br /><span className="muted">{p.campaign ? `${p.campaign.code} · ` : ""}{p.createdAt.toLocaleDateString("vi-VN")}{p.txRef ? ` · GD: ${p.txRef}` : ""}</span></td>
                    <td><Link href={`/admin/partnership/partners/${p.partner.id}`}>{p.partner.displayName}</Link></td>
                    <td><strong>{fmtUSD(p.amountCents)}</strong> {p.currency !== "USD" ? p.currency : ""}</td>
                    <td>{PAYMENT_TYPE[p.type]}<br /><span className="muted">{p.method || "—"}</span></td>
                    <td><span className={`crt-badge ${p.status === "PAID" ? "green" : p.status === "FAILED" || p.status === "CANCELLED" ? "red" : "amber"}`}>{PAYMENT_STATUS[p.status]}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {p.status === "DRAFT" && (
                          <form action={partnerPaymentFlowAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="kind" value="submit" /><button className="btn btn-dark btn-sm" type="submit">Trình duyệt</button></form>
                        )}
                        {p.status === "PENDING_APPROVAL" && (
                          <form action={partnerPaymentFlowAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="kind" value="approve" /><button className="btn btn-dark btn-sm" type="submit">Phê duyệt</button></form>
                        )}
                        {p.status === "APPROVED" && (
                          <form action={partnerPaymentFlowAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="kind" value="process" /><button className="btn btn-dark btn-sm" type="submit">Bắt đầu chi trả</button></form>
                        )}
                        {p.status === "PROCESSING" && (
                          <form action={partnerPaymentFlowAction} style={{ display: "flex", gap: 4 }}>
                            <input type="hidden" name="id" value={p.id} /><input type="hidden" name="kind" value="paid" />
                            <input name="txRef" placeholder="Mã giao dịch *" required style={{ width: 130 }} />
                            <input name="receiptUrl" placeholder="URL chứng từ" style={{ width: 120 }} />
                            <button className="btn btn-dark btn-sm" type="submit">Đã trả</button>
                          </form>
                        )}
                        {["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(p.status) && (
                          <form action={partnerPaymentFlowAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="kind" value="cancel" /><button className="btn btn-outline btn-sm" type="submit">Hủy khoản</button></form>
                        )}
                        {p.status === "PROCESSING" && (
                          <form action={partnerPaymentFlowAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="kind" value="fail" /><button className="btn btn-outline btn-sm" type="submit" style={{ color: "#B3261E" }}>Chi trả thất bại</button></form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
