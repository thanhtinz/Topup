"use client";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { setPrefsAction } from "@/app/actions";
import type { Cur } from "@/lib/moneyfmt";
import type { Lang } from "@/lib/i18n";

const CUR_NAMES: Record<string, string> = {
  USD: "US Dollar",
  VND: "Việt Nam Đồng",
  EUR: "Euro",
  THB: "Thai Baht",
  JPY: "Japanese Yen",
  KRW: "Korean Won",
  CNY: "Chinese Yuan",
  USDT: "Tether USD",
};

const LANGS: Array<{ code: Lang; name: string; tag: string }> = [
  { code: "vi", name: "Tiếng Việt", tag: "VI" },
  { code: "en", name: "English", tag: "EN" },
];

const Check = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#0B63E5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);

export default function PrefsSwitch({ lang, cur, currencies, enEnabled, names = {} }: { lang: Lang; cur: Cur; currencies: Cur[]; enEnabled: boolean; names?: Record<string, string> }) {
  const path = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const langRef = useRef<HTMLInputElement>(null);
  const curRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const pick = (patch: { lang?: Lang; code?: string }) => {
    if (patch.lang && langRef.current) langRef.current.value = patch.lang;
    if (patch.code && curRef.current) curRef.current.value = patch.code;
    setOpen(false);
    formRef.current?.requestSubmit();
  };

  const langs = LANGS.filter((l) => l.code === "vi" || enEnabled);

  return (
    <form action={setPrefsAction} ref={formRef} className="prefs-menu">
      <input type="hidden" name="next" value={path} />
      <input type="hidden" name="lang" defaultValue={lang} ref={langRef} />
      <input type="hidden" name="cur" defaultValue={cur.code} ref={curRef} />
      <button type="button" className="prefs-trigger" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>{cur.code}</span>
        <span className="prefs-sep">|</span>
        <span>{lang.toUpperCase()}</span>
      </button>
      {open && (
        <>
          <button type="button" aria-hidden="true" tabIndex={-1} className="prefs-veil" onClick={() => setOpen(false)} />
          <div className="prefs-card" role="menu">
            <div className="prefs-sec">Ngôn ngữ</div>
            {langs.map((l) => {
              const on = l.code === lang;
              return (
                <button key={l.code} type="button" role="menuitemradio" aria-checked={on} className={`prefs-row ${on ? "on" : ""}`} onClick={() => pick({ lang: l.code })}>
                  <span className="prefs-check">{on ? Check : null}</span>
                  <span className="prefs-name">{l.name}</span>
                  <span className="prefs-tag">{l.tag}</span>
                </button>
              );
            })}
            <div className="prefs-div" />
            <div className="prefs-sec">Tiền tệ</div>
            {currencies.map((c) => {
              const on = c.code === cur.code;
              return (
                <button key={c.code} type="button" role="menuitemradio" aria-checked={on} className={`prefs-row ${on ? "on" : ""}`} onClick={() => pick({ code: c.code })}>
                  <span className="prefs-check">{on ? Check : null}</span>
                  <span className="prefs-name">{CUR_NAMES[c.code] ?? names[c.code] ?? c.code}</span>
                  <span className="prefs-tag">{c.code}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </form>
  );
}
