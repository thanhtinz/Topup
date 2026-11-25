"use client";
import { useState } from "react";
import { createDepositAction } from "../../../actions";

export type WalletMethod = { code: string; tab: string };

const fmtVND = (n: number) => "₫" + n.toLocaleString("vi-VN");

export default function DepositForm({ methods, rate, minVnd = 130000, maxVnd = 13000000 }: { methods: WalletMethod[]; rate: number; minVnd?: number; maxVnd?: number }) {
  const CHIPS = [minVnd, minVnd * 2, minVnd * 5, minVnd * 10, minVnd * 20].filter((v) => v <= maxVnd);
  const [method, setMethod] = useState(methods[0]?.code ?? "");
  const [vnd, setVnd] = useState(String(minVnd * 2));
  const vndNum = parseInt(vnd.replace(/\D/g, ""), 10) || 0;
  const approxUsd = rate > 0 && vndNum > 0 ? vndNum / rate : 0;
  if (!methods.length) {
    return <div className="wl-notice">Cổng nạp đang bảo trì — vui lòng quay lại sau hoặc liên hệ hỗ trợ.</div>;
  }
  return (
    <form action={createDepositAction}>
      <div className="wl-methods" role="tablist" aria-label="Phương thức nạp">
        {methods.map((m) => (
          <button key={m.code} type="button" role="tab" aria-selected={method === m.code} className={`wl-method ${method === m.code ? "on" : ""}`} onClick={() => setMethod(m.code)}>
            {m.tab}
          </button>
        ))}
      </div>
      <div className="wl-amounts">
        {CHIPS.map((v) => (
          <button key={v} type="button" className={`wl-amt ${vndNum === v ? "on" : ""}`} onClick={() => setVnd(String(v))}>
            {fmtVND(v)}
          </button>
        ))}
      </div>
      <div className="wl-label">Số tiền tùy chọn</div>
      <input className="wl-input" name="amountVnd" inputMode="numeric" placeholder={`${minVnd} – ${maxVnd}`} value={vnd} onChange={(e) => setVnd(e.target.value.replace(/[^\d]/g, ""))} required aria-label="Số tiền nạp (VNĐ)" />
      {approxUsd > 0 && <div className="wl-approx">≈ ${approxUsd.toFixed(2)} sẽ vào ví (tỉ giá ₫{rate.toLocaleString("vi-VN")}/$)</div>}
      <input type="hidden" name="method" value={method} />
      <button className="wl-cta" type="submit">
        {method === "BNTPAY" ? (
          <>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v12M9 9.5c0-1 1.3-1.5 3-1.5s3 .5 3 1.5-1 1.6-3 2-3 1-3 2 1.3 1.5 3 1.5 3-.5 3-1.5" /></svg>
            Thanh toán bằng USDT
          </>
        ) : (
          <>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 18v-7M9.5 18v-7M14.5 18v-7M19 18v-7" /><path d="m12 3 9 5H3l9-5Z" /></svg>
            Thanh toán qua ngân hàng VND
          </>
        )}
      </button>
    </form>
  );
}
