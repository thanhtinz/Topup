import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { creatorBalances, creatorConfig, getCreatorByUser } from "@/lib/creator";
import { fmtMoney } from "@/lib/moneyfmt";
import { getPrefs } from "@/lib/prefs";
import { requestPayoutAction } from "@/app/creator/actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", PROCESSING: "Đang xử lý", PAID: "Đã thanh toán", REJECTED: "Bị từ chối", FAILED: "Thất bại" };

export default async function CreatorPayouts({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const { cur, lang } = await getPrefs();
  const fmt = (c: number) => fmtMoney(c, cur, lang);
  const user = (await getCurrentUser())!;
  const creator = (await getCreatorByUser(user.id))!;
  const [bal, cfg] = await Promise.all([creatorBalances(creator.id), creatorConfig()]);
  const payouts = await prisma.creatorPayout.findMany({ where: { creatorId: creator.id }, orderBy: { createdAt: "desc" }, take: 30 });
  return (
    <div>
      {msg && <p className="crt-badge green" style={{ display: "block", padding: "10px 14px", marginBottom: 12 }}>{msg}</p>}
      {err && <p className="crt-badge red" style={{ display: "block", padding: "10px 14px", marginBottom: 12 }}>{err}</p>}
      <div className="crt-stats">
        <div className="crt-stat"><div className="k">Có thể rút</div><div className="v" style={{ color: "var(--accent)" }}>{fmt(bal.availableCents)}</div></div>
        <div className="crt-stat"><div className="k">Đang chờ xử lý rút</div><div className="v">{fmt(bal.lockedCents)}</div></div>
        <div className="crt-stat"><div className="k">Đã rút thành công</div><div className="v">{fmt(bal.paidOutCents)}</div></div>
        <div className="crt-stat"><div className="k">Mức rút tối thiểu</div><div className="v">{fmt(cfg.minWithdrawCents)}</div></div>
      </div>

      <div className="crt-card crt-form">
        <h3>Yêu cầu rút tiền</h3>
        <form action={requestPayoutAction}>
          <input type="hidden" name="kind" value="payout" />
          <div className="row">
            <div className="field"><label>Số tiền (USD)</label><input name="amount" type="number" min="0" step="0.01" required placeholder="20.00" /></div>
            <div className="field">
              <label>Phương thức</label>
              <select name="method">
                <option value="USDT">USDT (TRC20)</option>
                <option value="BANK">Chuyển khoản ngân hàng VN</option>
              </select>
            </div>
          </div>
          <div className="field"><label>Thông tin nhận tiền (địa chỉ ví USDT / số tài khoản + tên ngân hàng + chủ tài khoản)</label><input name="destination" required placeholder="vd: Techcombank · 1903xxxxxx · NGUYEN VAN A" /></div>
          <button className="btn btn-primary" type="submit">Gửi yêu cầu rút</button>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 10 }}>Thời gian xử lý 3–7 ngày làm việc. Số tiền được khoá ngay khi gửi yêu cầu để không bị rút trùng.</p>
        </form>
      </div>

      <h3 style={{ margin: "22px 0 10px" }}>Lịch sử rút tiền</h3>
      {payouts.length === 0 ? (
        <div className="crt-card"><p>Chưa có yêu cầu rút tiền nào.</p></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="crt-table">
            <thead><tr><th>Ngày</th><th>Số tiền</th><th>Phương thức</th><th>Trạng thái</th><th>Mã giao dịch</th></tr></thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td>{p.createdAt.toLocaleDateString("vi-VN")}</td>
                  <td><strong>{fmt(p.amountCents)}</strong></td>
                  <td>{p.method}</td>
                  <td><span className={`crt-badge ${p.status === "PAID" ? "green" : p.status === "REJECTED" || p.status === "FAILED" ? "red" : "gray"}`}>{STATUS[p.status] ?? p.status}</span>{p.reviewNote && <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{p.reviewNote}</span>}</td>
                  <td>{p.txRef || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
