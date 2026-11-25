"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { buySteamGiftAction } from "@/app/actions";
import { ClientRefInput } from "@/components/ClientRefInput";
import { fmtMoney, type Cur } from "@/lib/moneyfmt";

export type GiftGameCard = { appid: number; name: string; image: string };
type GiftOffer = { subId: string; name: string; regions: { region: string; priceCents: number }[] };

type Props = {
  loggedIn: boolean;
  balanceCents: number;
  initialGames: GiftGameCard[];
  totalGames: number;
  cur: Cur;
  lang: string;
};

const REGION_FLAG_ALIAS: Record<string, string> = { UK: "gb", EURO: "eu" };
const REGION_FLAG_CODES = new Set([
  "ae", "ar", "au", "br", "by", "ca", "ch", "cl", "cn", "co", "cr", "de", "eu", "gb", "hk", "id", "il", "in", "jp", "kr", "kw", "kz",
  "mx", "my", "no", "nz", "pe", "ph", "pk", "pl", "qa", "ru", "sa", "sg", "th", "tr", "tw", "ua", "us", "uy", "vn", "za",
]);
export function regionFlagUrl(region: string): string | null {
  const code = String(region || "").trim().toUpperCase();
  const iso = REGION_FLAG_ALIAS[code] || (/^[A-Z]{2}$/.test(code) ? code.toLowerCase() : null);
  return iso && REGION_FLAG_CODES.has(iso) ? `/flags/${iso}.png` : null;
}
function RegionFlag({ region }: { region: string }) {
  const url = regionFlagUrl(region);
  if (!url) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8494AC" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.9 5.7 3.9 9S14.5 18.4 12 21c-2.5-2.6-3.9-5.7-3.9-9S9.5 5.6 12 3Z" />
      </svg>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" className="gift-flag" referrerPolicy="no-referrer" />;
}

const REGION_NAMES_VI: Record<string, string> = {
  UA: "Ukraina", RU: "Nga", KZ: "Kazakhstan", BY: "Belarus", TR: "Thổ Nhĩ Kỳ", AR: "Argentina", BR: "Brazil",
  ID: "Indonesia", VN: "Việt Nam", TH: "Thái Lan", MY: "Malaysia", PH: "Philippines", SG: "Singapore",
  HK: "Hồng Kông", TW: "Đài Loan", JP: "Nhật Bản", KR: "Hàn Quốc", CN: "Trung Quốc", IN: "Ấn Độ",
  US: "Hoa Kỳ", CA: "Canada", MX: "Mexico", CO: "Colombia", CL: "Chile", PE: "Peru", UY: "Uruguay", CR: "Costa Rica",
  UK: "Anh", GB: "Anh", DE: "Đức", PL: "Ba Lan", NO: "Na Uy", CH: "Thụy Sĩ", AU: "Úc", NZ: "New Zealand",
  ZA: "Nam Phi", AE: "UAE", SA: "Ả Rập Xê Út", QA: "Qatar", KW: "Kuwait", IL: "Israel", PK: "Pakistan",
};
const REGION_NAMES_EN: Record<string, string> = {
  UA: "Ukraine", RU: "Russia", KZ: "Kazakhstan", BY: "Belarus", TR: "Turkey", AR: "Argentina", BR: "Brazil",
  ID: "Indonesia", VN: "Vietnam", TH: "Thailand", MY: "Malaysia", PH: "Philippines", SG: "Singapore",
  HK: "Hong Kong", TW: "Taiwan", JP: "Japan", KR: "South Korea", CN: "China", IN: "India",
  US: "United States", CA: "Canada", MX: "Mexico", CO: "Colombia", CL: "Chile", PE: "Peru", UY: "Uruguay", CR: "Costa Rica",
  UK: "United Kingdom", GB: "United Kingdom", DE: "Germany", PL: "Poland", NO: "Norway", CH: "Switzerland", AU: "Australia", NZ: "New Zealand",
  ZA: "South Africa", AE: "UAE", SA: "Saudi Arabia", QA: "Qatar", KW: "Kuwait", IL: "Israel", PK: "Pakistan",
};

const GiftIco = (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v9h14v-9M12 8s-4.5.2-6.2-1.2C4.2 5.4 5 3 7 3c2.5 0 5 5 5 5Zm0 0s4.5.2 6.2-1.2C19.8 5.4 19 3 17 3c-2.5 0-5 5-5 5Z" />
  </svg>
);
const SteamGlyph = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#0B1B33" aria-hidden><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" /></svg>
);

export default function SteamGift(p: Props) {
  const en = p.lang === "en";
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<GiftGameCard[] | null>(null);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [game, setGame] = useState<GiftGameCard | null>(null);
  const [offers, setOffers] = useState<GiftOffer[] | null>(null);
  const [offersLoading, setOffersLoading] = useState(false);
  const [subId, setSubId] = useState("");
  const [region, setRegion] = useState("");
  const [invite, setInvite] = useState("");
  const [regionOpen, setRegionOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);
  const searchSeq = useRef(0);

  const T = {
    title: en ? "Gift Steam games" : "Tặng game Steam",
    headSub: en
      ? "Buy Steam games as gifts from the cheapest store region — sent straight to your account via a Steam friend invite."
      : "Mua game Steam dạng quà tặng ở khu vực cửa hàng rẻ nhất — gửi thẳng vào tài khoản của bạn qua lời mời kết bạn.",
    step1: en ? "Choose the game and edition" : "Chọn game và phiên bản",
    step2: en ? "Choose the store region — the cheapest one is labelled" : "Chọn khu vực cửa hàng — khu vực rẻ nhất được gắn nhãn",
    step3: en ? "Paste the Steam invite link — the gift is sent automatically" : "Dán link mời Steam — quà được gửi tự động",
    notes: en ? "Read before ordering" : "Lưu ý trước khi đặt",
    noteItems: en
      ? [
          "Gifts are region-locked: only a Steam account in the store region you choose can receive and activate the game.",
          "The invite link must be the friend-invite link of the exact receiving account (s.team/p/p/... or steamcommunity.com). A wrong link sends the gift to someone else.",
          "The receiver needs to accept the friend request and the gift on Steam after the order completes.",
          "The price is locked to the live offer when you order — if it just changed, the newest price for your chosen region applies.",
        ]
      : [
          "Quà khoá khu vực: chỉ tài khoản Steam thuộc khu vực cửa hàng bạn chọn mới nhận và kích hoạt được game.",
          "Link mời phải là link mời kết bạn của đúng tài khoản nhận quà (dạng s.team/p/p/... hoặc steamcommunity.com). Dán sai link, quà sẽ gửi nhầm người.",
          "Tài khoản nhận cần chấp nhận lời mời kết bạn và nhận quà trên Steam sau khi đơn hoàn tất.",
          "Giá chốt theo offer tại thời điểm đặt đơn — nếu giá vừa thay đổi, hệ thống tính theo giá mới nhất của khu vực đã chọn.",
        ],
    chooseGame: en ? "Choose a game" : "Chọn game",
    searchPh: en ? "Search by name or App ID..." : "Tìm theo tên hoặc App ID...",
    gamesCount: en ? "games on sale" : "game đang bán",
    searching: en ? "Searching…" : "Đang tìm game…",
    noMatch: en ? "No game matches your search" : "Không có game nào khớp tìm kiếm",
    moreResults: en ? "More results exist — type more characters to narrow it down" : "Còn nhiều kết quả nữa — nhập thêm ký tự để thu hẹp tìm kiếm",
    loginToSearch: en ? "Log in to search the full catalog" : "Đăng nhập để tìm trong toàn bộ danh mục",
    login: en ? "Log in" : "Đăng nhập",
    giftSuffix: en ? "Steam Gift" : "Quà tặng Steam",
    sendVia: en ? "Gift sent via a Steam friend invite" : "Gửi quà qua lời mời kết bạn Steam",
    platform: en ? "Platform" : "Nền tảng",
    viewOnSteam: en ? "View on Steam" : "Xem trên Steam",
    type: en ? "Type" : "Loại",
    regionLock: en ? "Region lock" : "Khóa khu vực",
    regionLockText: en ? "Only a Steam account in the chosen region can receive it" : "Chỉ tài khoản Steam thuộc khu vực đã chọn mới nhận được",
    regionLabel: en ? "Region:" : "Khu vực:",
    cheapest: en ? "Cheapest" : "Rẻ nhất",
    editions: en ? "All editions" : "Tất cả phiên bản",
    from: en ? "from" : "từ",
    loadingOffers: en ? "Loading editions and prices…" : "Đang tải phiên bản và giá…",
    noOffers: en ? "This game has no gift offers right now — try again in a few minutes." : "Game này hiện chưa có offer bán — thử lại sau ít phút.",
    loginToBuy: en ? "Log in to see editions and prices" : "Đăng nhập để xem phiên bản và giá",
    changeGame: en ? "Choose another game" : "Chọn game khác",
    summary: en ? "Summary" : "Tóm tắt",
    inviteLabel: en ? "Steam invite link" : "Link mời Steam",
    invitePh: en ? "Paste the short link s.team/p/p/..." : "Dán link ngắn s.team/p/p/...",
    edition: en ? "Edition" : "Phiên bản",
    regionRow: en ? "Region" : "Vùng",
    price: en ? "Price" : "Giá",
    inviteRow: en ? "Invite link" : "Link mời",
    proceed: en ? "Proceed" : "Tiến hành",
    balance: en ? "Wallet balance" : "Số dư ví",
    notEnough: en ? "Not enough balance — top up your wallet first." : "Số dư không đủ — nạp thêm ví trước nhé.",
    deposit: en ? "Top up wallet" : "Nạp ví",
  };

  useEffect(() => {
    const s = q.trim();
    if (!s || !p.loggedIn) { setRemote(null); setSearching(false); return; }
    setSearching(true);
    const seq = ++searchSeq.current;
    const timer = setTimeout(() => {
      fetch(`/api/steam-gift/games?q=${encodeURIComponent(s)}`)
        .then((r) => r.json())
        .then((j) => {
          if (searchSeq.current !== seq) return;
          setRemote(Array.isArray(j?.games) ? j.games : []);
          setRemoteTotal(Number(j?.total) || 0);
        })
        .catch(() => { if (searchSeq.current === seq) { setRemote([]); setRemoteTotal(0); } })
        .finally(() => { if (searchSeq.current === seq) setSearching(false); });
    }, 300);
    return () => clearTimeout(timer);
  }, [q, p.loggedIn]);

  useEffect(() => {
    if (!game || !p.loggedIn) { setOffers(null); setSubId(""); setRegion(""); return; }
    let cancelled = false;
    setOffersLoading(true);
    setOffers(null);
    fetch(`/api/steam-gift/offers?appid=${game.appid}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const list: GiftOffer[] = Array.isArray(j?.offers) ? j.offers : [];
        setOffers(list);
        const first = list[0];
        if (first) {
          setSubId(String(first.subId));
          setRegion(first.regions[0]?.region || "");
        } else { setSubId(""); setRegion(""); }
      })
      .catch(() => { if (!cancelled) { setOffers([]); setSubId(""); setRegion(""); } })
      .finally(() => { if (!cancelled) setOffersLoading(false); });
    return () => { cancelled = true; };
  }, [game, p.loggedIn]);

  useEffect(() => {
    if (!regionOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setRegionOpen(false); };
    const onClick = (e: MouseEvent) => { if (regionRef.current && !regionRef.current.contains(e.target as Node)) setRegionOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [regionOpen]);

  const displayGames = q.trim() && p.loggedIn ? (remote ?? []) : p.initialGames;
  const offer = offers?.find((o) => String(o.subId) === subId) || null;
  const regionRow = offer?.regions.find((r) => r.region === region) || null;
  const price = regionRow?.priceCents || 0;
  const cheapestRegion = offer?.regions[0]?.region;
  const regionName = (code: string) => (en ? REGION_NAMES_EN[code] : REGION_NAMES_VI[code]) || code;
  const minPrice = (o: GiftOffer) => o.regions.reduce((min, r) => (min === 0 || r.priceCents < min ? r.priceCents : min), 0);
  const insufficient = p.loggedIn && price > 0 && price > p.balanceCents;
  const canSubmit = !!game && !!offer && !!regionRow && invite.trim().length >= 8 && price > 0 && !insufficient;
  const pickOffer = (o: GiftOffer) => { setSubId(String(o.subId)); setRegion(o.regions[0]?.region || ""); setRegionOpen(false); };

  if (!game) {
    return (
      <div className="gift-wrap">
        <section className="gift-hero">
          <div className="gift-hero-top">
            <span className="gift-ico" aria-hidden>{GiftIco}</span>
            <div>
              <h1>{T.title}</h1>
              <p>{T.headSub}</p>
            </div>
          </div>
          <ol className="gift-steps">
            <li><span className="gift-step-n">1</span><span>{T.step1}</span></li>
            <li><span className="gift-step-n">2</span><span>{T.step2}</span></li>
            <li><span className="gift-step-n">3</span><span>{T.step3}</span></li>
          </ol>
          <div className="gift-notes">
            <button type="button" className="gift-notes-btn" aria-expanded={notesOpen} onClick={() => setNotesOpen((v) => !v)}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" />
              </svg>
              <span>{T.notes}</span>
              <svg className={notesOpen ? "gift-chev open" : "gift-chev"} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {notesOpen && (
              <ul className="gift-notes-list">
                {T.noteItems.map((n) => <li key={n}>{n}</li>)}
              </ul>
            )}
          </div>
        </section>

        <h2 className="gift-h2">{T.chooseGame}</h2>
        <div className="gift-search">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#8494AC" strokeWidth="2.2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.8-3.8" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T.searchPh} autoComplete="off" maxLength={80} />
        </div>
        {!p.loggedIn && q.trim() ? (
          <p className="gift-login-hint">
            {T.loginToSearch} — <Link href="/login?next=/game/steam-gift">{T.login}</Link>
          </p>
        ) : (
          <>
            {p.totalGames > 0 && <p className="gift-count">{p.totalGames.toLocaleString("vi-VN")} {T.gamesCount}</p>}
            <div className="gift-grid">
              {searching && displayGames.length === 0 && <p className="gift-empty">{T.searching}</p>}
              {!searching && displayGames.length === 0 && <p className="gift-empty">{T.noMatch}</p>}
              {displayGames.map((g) => (
                <button type="button" key={g.appid} className="gift-game-card" onClick={() => setGame(g)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.image} alt={g.name} loading="lazy" referrerPolicy="no-referrer" />
                  <span className="gift-game-name">{g.name}</span>
                  <span className="gift-game-appid">App ID · {g.appid}</span>
                </button>
              ))}
            </div>
            {q.trim() && remote && remoteTotal > remote.length && <p className="gift-more">{T.moreResults}</p>}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="gift-wrap">
      <button type="button" className="gift-back" onClick={() => setGame(null)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 6-6 6 6 6" /></svg>
        {T.changeGame}
      </button>
      <div className="gift-cols">
        <section className="gift-card">
          <h1 className="gift-title">{game.name} | {T.giftSuffix}</h1>
          <p className="gift-sub">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="#F5A301" aria-hidden><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" /></svg>
            {T.sendVia}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gift-capsule" src={game.image} alt={game.name} referrerPolicy="no-referrer" />
          <div className="gift-info">
            <div className="gift-info-row">
              <span className="gift-info-ico" aria-hidden>{SteamGlyph}</span>
              <div>
                <span className="gift-info-k">{T.platform}:</span> <b>Steam</b>
                <br />
                <a className="gift-store-link" href={`https://store.steampowered.com/app/${game.appid}/`} target="_blank" rel="noreferrer">
                  {T.viewOnSteam}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 17 17 7M9 7h8v8" /></svg>
                </a>
              </div>
            </div>
            <div className="gift-info-row">
              <span className="gift-info-ico" aria-hidden>
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#0B1B33" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v9h14v-9M12 8s-4.5.2-6.2-1.2C4.2 5.4 5 3 7 3c2.5 0 5 5 5 5Zm0 0s4.5.2 6.2-1.2C19.8 5.4 19 3 17 3c-2.5 0-5 5-5 5Z" /></svg>
              </span>
              <div><span className="gift-info-k">{T.type}:</span> <b>{T.giftSuffix}</b></div>
            </div>
            <div className="gift-info-row">
              <span className="gift-info-ico" aria-hidden>
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#0B1B33" strokeWidth="1.9" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></svg>
              </span>
              <div><span className="gift-info-k">{T.regionLock}:</span> <span className="gift-warn-text">{T.regionLockText}</span></div>
            </div>
          </div>

          {!p.loggedIn ? (
            <p className="gift-login-hint" style={{ marginTop: 18 }}>
              {T.loginToBuy} — <Link href="/login?next=/game/steam-gift">{T.login}</Link>
            </p>
          ) : offersLoading ? (
            <p className="gift-loading">{T.loadingOffers}</p>
          ) : !offers || offers.length === 0 ? (
            <p className="gift-loading">{T.noOffers}</p>
          ) : (
            <>
              <span className="gift-label">{T.regionLabel}</span>
              <div className="gift-region" ref={regionRef}>
                <button type="button" className="gift-region-btn" aria-expanded={regionOpen} onClick={() => setRegionOpen((v) => !v)}>
                  {regionRow ? (
                    <>
                      <RegionFlag region={regionRow.region} />
                      <span className="gift-region-name">{regionName(regionRow.region)}</span>
                      {regionRow.region === cheapestRegion && <span className="gift-cheapest">{T.cheapest}</span>}
                      <b>{fmtMoney(regionRow.priceCents, p.cur, p.lang)}</b>
                    </>
                  ) : <span className="gift-region-name">—</span>}
                  <svg className={regionOpen ? "gift-chev open" : "gift-chev"} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8494AC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
                </button>
                {regionOpen && offer && (
                  <div className="gift-region-list">
                    {offer.regions.map((r) => (
                      <button
                        type="button"
                        key={r.region}
                        className={r.region === region ? "gift-region-item sel" : "gift-region-item"}
                        onClick={() => { setRegion(r.region); setRegionOpen(false); }}
                      >
                        <RegionFlag region={r.region} />
                        <span className="gift-region-name">{regionName(r.region)}</span>
                        {r.region === cheapestRegion && <span className="gift-cheapest">{T.cheapest}</span>}
                        <b>{fmtMoney(r.priceCents, p.cur, p.lang)}</b>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="gift-label">{T.editions}</span>
              <div className="gift-editions">
                {offers.map((o) => {
                  const selected = offer?.subId === o.subId;
                  return (
                    <button type="button" key={String(o.subId)} className={selected ? "gift-edition sel" : "gift-edition"} onClick={() => pickOffer(o)}>
                      <span>
                        <span className="gift-edition-name">{o.name}</span>
                        <span className="gift-edition-from">{T.from} {fmtMoney(minPrice(o), p.cur, p.lang)}</span>
                      </span>
                      {selected && (
                        <span className="gift-check" aria-hidden>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 12.5 5 5 10-11" /></svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <aside>
          <form action={buySteamGiftAction} className="gift-card gift-summary">
        <ClientRefInput scope="steam-gift" />
            <input type="hidden" name="appid" value={game.appid} />
            <input type="hidden" name="subId" value={offer ? String(offer.subId) : ""} />
            <input type="hidden" name="region" value={regionRow?.region || ""} />
            <h2>{T.summary}</h2>
            <label className="gift-label" htmlFor="gift-invite" style={{ marginTop: 16 }}>{T.inviteLabel}</label>
            <input
              id="gift-invite"
              name="invite"
              className="gift-invite"
              placeholder={T.invitePh}
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              autoComplete="off"
              maxLength={300}
            />
            <div className="steam-sum-box" style={{ marginTop: 16 }}>
              <div className="steam-sum-row"><span>App ID</span><b>{game.appid}</b></div>
              <div className="steam-sum-row"><span>Package ID</span><b>{offer ? String(offer.subId) : "—"}</b></div>
              <div className="steam-sum-row"><span>{T.edition}</span><b>{offer ? offer.name : "—"}</b></div>
              <div className="steam-sum-row">
                <span>{T.regionRow}</span>
                <b className="gift-sum-region">{regionRow ? <><RegionFlag region={regionRow.region} />{regionRow.region}</> : "—"}</b>
              </div>
              <div className="steam-sum-row gift-price-row"><span>{T.price}</span><b>{offer && regionRow ? fmtMoney(price, p.cur, p.lang) : "—"}</b></div>
              <div className="steam-sum-row"><span>{T.inviteRow}</span><b className="gift-sum-invite">{invite.trim() || "—"}</b></div>
            </div>
            {p.loggedIn && (
              <p className="steam-bal">
                {T.balance}: <b>{fmtMoney(p.balanceCents, p.cur, p.lang)}</b>
                {insufficient && <> · <span className="steam-bal-warn">{T.notEnough}</span> <Link href="/account/deposit">{T.deposit}</Link></>}
              </p>
            )}
            <button type="submit" className="gift-submit" disabled={!canSubmit}>{T.proceed}</button>
          </form>
        </aside>
      </div>
    </div>
  );
}
