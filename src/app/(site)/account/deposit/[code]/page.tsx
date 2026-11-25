import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";
import { getSepayConfig, sepayQrUrl, parseProviderData } from "@/lib/gateways";
import { checkBntpayStatusAction } from "../../../../actions";

export const dynamic = "force-dynamic";

const fmtVND = (n: number) => n.toLocaleString("vi-VN") + " ₫";
const METHOD_LABEL: Record<string, string> = { SEPAY: "Chuyển khoản ngân hàng (SePay)", BNTPAY: "BNT Pay — USDT" };

export default async function DepositDetail({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const { code } = await params;
  const { msg, err } = await searchParams;
  const dep = await prisma.depositRequest.findFirst({ where: { code, userId: user.id } });
  if (!dep) notFound();
  const data = parseProviderData(dep.providerData);
  const sepay = dep.method === "SEPAY" ? await getSepayConfig() : null;

  return (
    <main className="pf-wrap">
    <div className="pf-col">
      <p className="crumb"><Link href="/account/deposit">← Ví của tôi</Link></p>
      {msg && <div className="form-ok">{msg}</div>}
      {err && <div className="form-err">{err}</div>}
      {dep.status === "PENDING" && <div className="dep-banner wait"><b>Đang chờ thanh toán</b> — hoàn tất thanh toán theo hướng dẫn bên dưới, ví sẽ tự cộng khi hệ thống nhận được tiền.</div>}
      {dep.status === "APPROVED" && <div className="dep-banner ok"><b>Đã cộng tiền vào ví</b> — lệnh nạp hoàn tất. Cảm ơn bạn!</div>}
      {dep.status === "REJECTED" && <div className="dep-banner err"><b>Lệnh nạp không hoàn tất</b>{dep.note ? ` — ${dep.note}` : ""}</div>}

      <div className="acct-card">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Lệnh nạp {dep.code}</h2>
          <span className="muted">{METHOD_LABEL[dep.method] ?? dep.method}</span>
        </div>
        <div className="sum-row" style={{ marginTop: 10 }}><span className="muted">Số tiền vào ví</span><b style={{ fontSize: 16 }}>{fmtUSD(dep.amountCents)}</b></div>

        {dep.status === "PENDING" && dep.method === "SEPAY" && sepay && dep.vndAmount != null && (
          <div style={{ marginTop: 8 }}>
            <div className="sum-row"><span className="muted">Ngân hàng</span><b>{sepay.bankName || "—"}</b></div>
            <div className="sum-row"><span className="muted">Số tài khoản</span><b>{sepay.accountNumber}</b></div>
            <div className="sum-row"><span className="muted">Chủ tài khoản</span><b>{sepay.accountName}</b></div>
            <div className="sum-row"><span className="muted">Số tiền chuyển</span><b style={{ color: "var(--accent)", fontSize: 16 }}>{fmtVND(dep.vndAmount)}</b></div>
            <div className="sum-row"><span className="muted">Nội dung chuyển khoản</span><b>{dep.code}</b></div>
            {sepay.bankBin && (
              <img src={sepayQrUrl(sepay, dep.vndAmount, dep.code)} alt="QR chuyển khoản" style={{ width: 250, height: 250, objectFit: "contain", display: "block", margin: "18px auto", border: "1px solid var(--line)", borderRadius: 14 }} />
            )}
            <p className="muted" style={{ textAlign: "center" }}>Quét QR bằng app ngân hàng hoặc chuyển tay đúng số tiền và nội dung — hệ thống tự cộng ví ngay khi nhận được tiền.</p>
          </div>
        )}

        {dep.status === "PENDING" && dep.method === "BNTPAY" && (
          <div style={{ marginTop: 8 }}>
            <div className="sum-row"><span className="muted">Mạng</span><b>{String(data.network ?? "")}</b></div>
            {typeof data.cryptoAmount === "string" && <div className="sum-row"><span className="muted">Số USDT phải trả</span><b style={{ color: "var(--accent)", fontSize: 16 }}>{data.cryptoAmount} USDT</b></div>}
            {typeof data.paymentAddress === "string" && <div className="sum-row"><span className="muted">Địa chỉ ví nhận</span><b style={{ wordBreak: "break-all" }}>{data.paymentAddress}</b></div>}
            {typeof data.expiresAt === "string" && <div className="sum-row"><span className="muted">Hết hạn</span><span>{new Date(data.expiresAt).toLocaleString("vi-VN")}</span></div>}
            {typeof data.checkoutUrl === "string" && (
              <a className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} href={data.checkoutUrl} target="_blank" rel="noreferrer">Mở trang thanh toán BNT Pay</a>
            )}
            <form action={checkBntpayStatusAction} style={{ marginTop: 10 }}>
              <input type="hidden" name="code" value={dep.code} />
              <button className="btn btn-outline" style={{ width: "100%" }} type="submit">Tôi đã thanh toán — kiểm tra trạng thái</button>
            </form>
          </div>
        )}
      </div>
    </div>
    </main>
  );
}
