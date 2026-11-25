"use client";
import { useMemo, useState } from "react";
import { buyAction } from "@/app/actions";
import { fmtMoney, discountOf, type Cur } from "@/lib/moneyfmt";
import { normOptions } from "@/lib/fieldopts";
import { fieldLabel, fieldPlaceholder } from "@/lib/fieldlabels";
import type { Dict } from "@/lib/i18n";


type Pkg = { id: number; name: string; region: string; method: string; priceCents: number; listPriceCents: number | null; imageUrl: string | null };

type PkgGroup = "currency" | "pass" | "other";
function pkgGroup(name: string): PkgGroup {
  const n = name.toLowerCase();
  if (/pass|welkin|blessing|monthly|membership|member|starlight|subscription|weekly|thẻ|tháng|tuần/.test(n)) return "pass";
  if (/\d/.test(n)) return "currency";
  return "other";
}
type Field = { key: string; label: string; required: boolean; placeholder?: string; options?: Array<{ value: string; label: string } | string> };

function Section({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <section className="sec-card">
      <div className="sec-head">
        <span className="sec-num">{num}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function BuyPanel({ slug, cover, packages, fields, methodFields, loggedIn, userPoints, pointsEnabled, pointsMaxPct, vipName, vipPct, cur, lang, t, initialPkgId, initialFields }: { slug: string; cover: string; packages: Pkg[]; fields: Field[]; methodFields: Record<string, Field[]>; loggedIn: boolean; userPoints: number; pointsEnabled: boolean; pointsMaxPct: number; vipName: string | null; vipPct: number; cur: Cur; lang: string; t: Dict; initialPkgId?: number; initialFields?: Record<string, string> }) {
  const initialPkg = initialPkgId ? packages.find((p) => p.id === initialPkgId) : undefined;
  const regions = useMemo(() => Array.from(new Set(packages.map((p) => p.region))), [packages]);
  const [region, setRegion] = useState(initialPkg?.region ?? regions[0] ?? "");
  const methods = useMemo(() => Array.from(new Set(packages.filter((p) => p.region === region).map((p) => p.method))), [packages, region]);
  const [method, setMethod] = useState<string>(initialPkg?.method ?? "");
  const activeMethod = methods.includes(method) ? method : methods[0] ?? "";
  const visible = packages.filter((p) => p.region === region && p.method === activeMethod);
  const activeFields = methodFields[activeMethod]?.length ? methodFields[activeMethod] : fields;
  const groups = useMemo(() => {
    const g: Record<PkgGroup, Pkg[]> = { currency: [], pass: [], other: [] };
    for (const p of visible) g[pkgGroup(p.name)].push(p);
    return g;
  }, [visible]);
  const presentGroups = (["currency", "pass", "other"] as PkgGroup[]).filter((k) => groups[k].length > 0);
  const [tab, setTab] = useState<PkgGroup>(initialPkg ? pkgGroup(initialPkg.name) : "currency");
  const activeTab: PkgGroup = presentGroups.includes(tab) ? tab : presentGroups[0] ?? "currency";
  const shownPkgs = groups[activeTab];
  const [pkgId, setPkgId] = useState<number>(initialPkg?.id ?? 0);
  const activePkg = shownPkgs.find((p) => p.id === pkgId) ?? shownPkgs[0];
  const activeDisc = activePkg ? discountOf(activePkg.priceCents, activePkg.listPriceCents) : null;
  const [qty, setQty] = useState(1);
  const [usePts, setUsePts] = useState(false);
  const [ptsInput, setPtsInput] = useState("");
  const grossCents = (activePkg?.priceCents ?? 0) * qty;
  const vipDiscCents = vipName ? Math.floor((grossCents * vipPct) / 100) : 0;
  const maxUsePts = pointsEnabled ? Math.min(userPoints, Math.floor((grossCents * pointsMaxPct) / 100)) : 0;
  const ptsUsed = usePts ? Math.min(Math.max(0, parseInt(ptsInput || String(maxUsePts), 10) || 0), maxUsePts) : 0;

  return (
    <form action={buyAction} className="buy-layout">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="packageId" value={activePkg?.id ?? ""} />
      <div>
        <Section num={1} title={t.s1}>
          <div className="pill-row">
            {regions.map((r) => (
              <button type="button" key={r} className="pill" aria-pressed={r === region} onClick={() => setRegion(r)}>{r}</button>
            ))}
          </div>
        </Section>

        <Section num={2} title={t.s2}>
          <div className="pill-row">
            {methods.map((m) => (
              <button type="button" key={m} className="pill" aria-pressed={m === activeMethod} onClick={() => setMethod(m)}>{m}</button>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            {activeMethod.includes("Login") ? t.method_login_note : t.method_uid_note}
          </p>
        </Section>

        <Section num={3} title={t.s3}>
          {presentGroups.length > 1 && (
            <div className="pill-row tabs-row" style={{ marginBottom: 12 }}>
              {presentGroups.map((k) => (
                <button type="button" key={k} className="pill" aria-pressed={k === activeTab} onClick={() => setTab(k)}>
                  {k === "currency" ? t.tab_currency : k === "pass" ? t.tab_pass : t.tab_other} ({groups[k].length})
                </button>
              ))}
            </div>
          )}
          <div className="pkg-grid">
            {shownPkgs.map((p) => {
              const disc = discountOf(p.priceCents, p.listPriceCents);
              const selected = activePkg?.id === p.id;
              return (
                <button type="button" key={p.id} className="pkg" aria-pressed={selected} onClick={() => setPkgId(p.id)}>
                  {p.imageUrl ? (<span className="pkg-img"><img src={p.imageUrl} alt={p.name} loading="lazy" referrerPolicy="no-referrer" /></span>) : (<span className="pkg-img pkg-img--empty" aria-hidden>{p.name.trim().charAt(0).toUpperCase() || "?"}</span>)}
                  <span className="pkg-info">
                    <b>{p.name}</b>
                    <span className="pkg-price">{fmtMoney(p.priceCents, cur, lang)}</span>
                    {disc && <span className="pkg-list">{fmtMoney(p.listPriceCents!, cur, lang)}</span>}
                    {disc && <span className="pkg-off">-{fmtMoney(disc.savings, cur, lang)} (-{disc.pct}%)</span>}
                  </span>
                  {selected && (
                    <span className="pkg-check" aria-hidden>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {!shownPkgs.length && <p className="muted">{t.pkg_empty}</p>}
        </Section>

        <Section num={4} title={t.s4}>
          {activeFields.map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={`field_${f.key}`}>{f.key === "contact" ? "Link Messenger hoặc Telegram" : fieldLabel(f, lang)}{f.required ? " *" : ""}</label>
              {f.options?.length ? (
                <select id={`field_${f.key}`} name={`field_${f.key}`} required={f.required} defaultValue={initialFields?.[f.key] ?? ""}>
                  <option value="" disabled>{t.select_placeholder}</option>
                  {normOptions(f.options).map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              ) : (
                <input id={`field_${f.key}`} name={`field_${f.key}`} required={f.required} defaultValue={initialFields?.[f.key] ?? ""} placeholder={f.key === "contact" ? t.contact_placeholder : fieldPlaceholder(f, lang)} />
              )}
            </div>
          ))}
          {!activeFields.length && <p className="muted">{t.no_fields}</p>}
        </Section>
      </div>

      <aside className="summary-card">
        <div className="sec-head">
          <span className="sec-num">5</span>
          <h2>{t.s5}</h2>
        </div>
        <div className="sum-row"><span className="muted">{t.selected_pkg}</span><b style={{ textAlign: "right" }}>{activePkg ? activePkg.name : "—"}</b></div>
        <div className="sum-row"><span className="muted">{t.region_method}</span><span>{region} · {activeMethod}</span></div>
        <div className="sum-row"><span className="muted">{t.unit_price}</span><span>{activePkg ? fmtMoney(activePkg.priceCents, cur, lang) : "—"}</span></div>
        <div style={{ margin: "12px 0" }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{t.qty}</label>
          <div className="qty-row">
            <button type="button" className="qty-btn" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Giảm">−</button>
            <input name="qty" type="number" min={1} max={10} value={qty} onChange={(e) => setQty(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} style={{ width: 72, height: 40, textAlign: "center", border: "1px solid var(--line)", borderRadius: 12, fontFamily: "inherit", fontSize: 15 }} />
            <button type="button" className="qty-btn" onClick={() => setQty(Math.min(10, qty + 1))} aria-label="Tăng">+</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="promo">{t.promo}</label>
          <input id="promo" name="promo" placeholder={t.promo_ph} />
        </div>
        {pointsEnabled && loggedIn && userPoints > 0 && (
          <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "11px 13px", marginBottom: 14, background: "#FFFBF5" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
              <input type="checkbox" checked={usePts} onChange={(e) => setUsePts(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m12 7 1.8 3.6 4 .6-2.9 2.8 1 3.9-3.9-2-3.9 2 1-3.9L6.2 11.2l4-.6L12 7Z" /></svg>
              {t.use_points} — {t.your_points}: {userPoints.toLocaleString()} {t.points_unit}
            </label>
            {usePts && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <input type="number" min={0} max={maxUsePts} value={ptsInput} placeholder={String(maxUsePts)} onChange={(e) => setPtsInput(e.target.value)} style={{ width: 110, height: 38, border: "1px solid var(--line)", borderRadius: 10, padding: "0 10px", fontFamily: "inherit", fontSize: 14 }} aria-label={t.use_points} />
                <span className="muted" style={{ fontSize: 12.5 }}>{t.points_cap} {pointsMaxPct}% {t.points_per_order} (= {fmtMoney(maxUsePts, cur, lang)})</span>
              </div>
            )}
            <input type="hidden" name="usePoints" value={ptsUsed} />
          </div>
        )}
        {activeDisc && <div className="sum-row"><span className="muted">{t.you_save}</span><span style={{ color: "#D92D20", fontWeight: 700 }}>-{fmtMoney(activeDisc.savings * qty, cur, lang)} (-{activeDisc.pct}%)</span></div>}
        {vipDiscCents > 0 && <div className="sum-row"><span className="muted">Giảm VIP {vipName} (-{vipPct}%)</span><span style={{ color: "#D92D20", fontWeight: 700 }}>-{fmtMoney(vipDiscCents, cur, lang)}</span></div>}
        {ptsUsed > 0 && <div className="sum-row"><span className="muted">{t.use_points} ({ptsUsed.toLocaleString()} {t.points_unit})</span><span style={{ color: "#D92D20", fontWeight: 700 }}>-{fmtMoney(ptsUsed, cur, lang)}</span></div>}
        <div className="sum-row total"><span>{t.total_wallet}</span><b style={{ color: "var(--accent)", fontFamily: "var(--font-display)", fontSize: 22 }}>{activePkg ? fmtMoney(grossCents - vipDiscCents - ptsUsed, cur, lang) : "—"}</b></div>
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} type="submit" disabled={!activePkg}>
          {loggedIn ? t.buy_now : t.login_to_buy}
        </button>
        <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>{activeMethod.includes("Login") ? t.buy_note_login : t.buy_note}</p>
      </aside>
    </form>
  );
}
