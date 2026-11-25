"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { buySteamAction } from "@/app/actions";
import { ClientRefInput } from "@/components/ClientRefInput";
import { fmtMoney, type Cur } from "@/lib/moneyfmt";

type Props = {
  loggedIn: boolean;
  balanceCents: number;
  unitPriceCents: number; 
  receiveRateVnd: number; 
  vndRatePerUsd: number; 
  minCents: number;
  maxCents: number;
  cur: Cur;
  lang: string;
};

export default function SteamTopup(p: Props) {
  const en = p.lang === "en";
  const [login, setLogin] = useState("");
  const [amount, setAmount] = useState("5");
  const [tip, setTip] = useState(false);
  const warnRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!tip) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setTip(false); };
    const onClick = (e: MouseEvent) => { if (warnRef.current && !warnRef.current.contains(e.target as Node)) setTip(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [tip]);

  const am = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  const amountCents = am ? parseInt(am[1]) * 100 + parseInt((am[2] || "0").padEnd(2, "0")) : null;
  const inRange = amountCents !== null && amountCents >= p.minCents && amountCents <= p.maxCents;
  const payCents = amountCents !== null ? Math.ceil((p.unitPriceCents * amountCents) / 100) : 0;
  const receiveCents = amountCents !== null && p.vndRatePerUsd > 0
    ? Math.round(((amountCents / 100) * p.receiveRateVnd * 100) / p.vndRatePerUsd)
    : 0;
  const insufficient = p.loggedIn && inRange && payCents > p.balanceCents;

  const T = {
    headSub: en ? "Top up Steam by login name. Enter the amount you need." : "Nạp Steam bằng tên đăng nhập. Nhập số tiền cần nạp.",
    detail: en ? "Top-up details" : "Chi tiết nạp tiền",
    detailSub: en ? "Steam login and the amount to top up." : "Steam login và số tiền cần nạp.",
    loginLabel: "Steam login",
    loginPh: "Steam login",
    loginHint: en ? "Enter the login name of the Steam account to top up." : "Nhập tên đăng nhập của tài khoản Steam cần nạp.",
    tip: en
      ? "Your Steam login name. Entering the wrong login will top up someone else's account."
      : "Tên đăng nhập Steam của bạn. Nhập sai login sẽ nạp nhầm vào tài khoản của người khác.",
    amountLabel: en ? "Top-up amount (USD)" : "Số tiền nạp (USD)",
    amountHint: en
      ? "Enter the amount you want — cents allowed, e.g. 10.50. Your Steam wallet receives exactly this amount."
      : "Nhập số tiền muốn nạp — được lẻ tới cent, ví dụ 10.50. Tiền vào ví Steam đúng số tiền này.",
    summary: en ? "Summary" : "Tóm tắt",
    summarySub: en ? "Totals update with the amount you enter." : "Tổng tiền cập nhật theo số tiền bạn nhập.",
    receive: en ? "You receive" : "Sẽ nhận",
    pay: en ? "To pay" : "Cần thanh toán",
    cont: en ? "Continue" : "Tiếp tục",
    balance: en ? "Wallet balance" : "Số dư ví",
    notEnough: en ? "Not enough balance — top up your wallet first." : "Số dư không đủ — nạp thêm ví trước nhé.",
    deposit: en ? "Top up wallet" : "Nạp ví",
    range: en
      ? `Amount per top-up: $${(p.minCents / 100).toFixed(2)} – $${(p.maxCents / 100).toLocaleString("en-US")}.`
      : `Mỗi lần nạp từ $${(p.minCents / 100).toFixed(2)} đến $${(p.maxCents / 100).toLocaleString("en-US")}.`,
  };

  return (
    <form action={buySteamAction} className="steam-wrap">
        <ClientRefInput />
      <div className="steam-head">
        <h1>Steam Top-Up (CIS)</h1>
        <p>{T.headSub}</p>
      </div>

      <div className="steam-card">
        <div className="steam-form-head">
          <span className="steam-ico" aria-hidden>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="#fff" aria-hidden><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" /></svg>
          </span>
          <div>
            <h2>{T.detail}</h2>
            <p>{T.detailSub}</p>
          </div>
        </div>

        <label className="steam-label" htmlFor="steam-login">{T.loginLabel}</label>
        <div className="steam-input-wrap">
          <input
            id="steam-login"
            name="steamLogin"
            className="steam-input"
            placeholder={T.loginPh}
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="off"
            maxLength={64}
          />
          <span className="steam-warn-wrap" ref={warnRef}>
            <button
              type="button"
              className="steam-warn"
              aria-label={T.tip}
              aria-expanded={tip}
              onClick={() => setTip((v) => !v)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            </button>
            {tip && <span className="steam-tip" role="tooltip">{T.tip}</span>}
          </span>
        </div>
        <p className="steam-hint">{T.loginHint}</p>

        <label className="steam-label" htmlFor="steam-amount">{T.amountLabel}</label>
        <div className="steam-input-wrap">
          <input
            id="steam-amount"
            name="amount"
            className="steam-input"
            inputMode="decimal"
            placeholder="5"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            autoComplete="off"
          />
          <span className="steam-cur">USD</span>
        </div>
        <p className="steam-hint">{T.amountHint} {T.range}</p>
      </div>

      <div className="steam-card">
        <div className="steam-sum-head">
          <h2>{T.summary}</h2>
          <p>{T.summarySub}</p>
        </div>
        <div className="steam-sum-box">
          <div className="steam-sum-row">
            <span>{T.receive}</span>
            <b>{amountCents !== null ? fmtMoney(receiveCents, p.cur, p.lang) : "—"}</b>
          </div>
          <div className="steam-sum-row total">
            <span>{T.pay}</span>
            <b>{amountCents !== null ? fmtMoney(payCents, p.cur, p.lang) : "—"}</b>
          </div>
        </div>
        {p.loggedIn && (
          <p className="steam-bal">
            {T.balance}: <b>{fmtMoney(p.balanceCents, p.cur, p.lang)}</b>
            {insufficient && (
              <>
                {" "}· <span className="steam-bal-warn">{T.notEnough}</span>{" "}
                <Link href="/account/deposit">{T.deposit}</Link>
              </>
            )}
          </p>
        )}
        <button type="submit" className="btn btn-primary steam-cta" disabled={amountCents === null || !inRange}>
          {T.cont}
        </button>
      </div>
    </form>
  );
}
