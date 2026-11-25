import { spawn } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
const CHROME = "/home/hatch/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const PORT = 9387;
const BASE = "http://127.0.0.1:3107";
const proc = spawn(CHROME, ["--headless", "--disable-gpu", "--no-sandbox", `--remote-debugging-port=${PORT}`, "--window-size=430,1000", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function wsUrl() { for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); const j = await r.json(); if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl; } catch {} await sleep(300); } throw new Error("no ws"); }
const ws = new WebSocket(await wsUrl());
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const S = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
await S("Page.enable"); await S("Runtime.enable"); await S("Network.enable");
const tok = readFileSync("/tmp/tok-demo.txt", "utf8").trim().split("\n").pop();
await S("Network.setCookie", { name: "bnttopup_session", value: tok, domain: "127.0.0.1", path: "/" });
async function go(url, w = 430, h = 1000, mobile = true) {
  await S("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile });
  await S("Page.navigate", { url });
  await sleep(2600);
}
async function ev(expr) {
  const r = await S("Runtime.evaluate", { expression: `JSON.stringify((${expr})())`, returnByValue: true });
  try { return JSON.parse(r?.result?.value ?? "null"); } catch { return r?.result?.value ?? null; }
}
async function shot(file) {
  const { data } = await S("Page.captureScreenshot", { format: "png" });
  writeFileSync(file, Buffer.from(data, "base64"));
  console.log("shot", file);
}
const out = {};

await go(BASE + "/account");
out.account = await ev(`() => ({
  hasAcctNav: !!document.querySelector('.acct-nav'),
  hasHopTac: document.body.innerText.includes('Hợp tác cùng BNTGame'),
  hasThanhTich: document.body.innerText.includes('Thành tích & huy hiệu'),
  hasHoSoNap: document.body.innerText.includes('Hồ sơ nạp'),
  hasGioiThieuCu: document.body.innerText.includes('Giới thiệu & Nhận thưởng')
})`);
await shot("shots/bao-cao-p2-account.png");

await go(BASE + "/account/deposit");
out.deposit = await ev(`() => {
  const panel = document.querySelector('.wl-panel');
  const notice = document.querySelector('.wl-notice');
  const cs = panel ? getComputedStyle(panel) : null;
  return {
    panelRadiusTL: cs?.borderTopLeftRadius, panelBorderTop: cs?.borderTopWidth,
    noticeBorderW: notice ? getComputedStyle(notice).borderTopWidth : 'no-notice',
    noticeText: notice ? notice.textContent.slice(0, 30) : null
  };
}`);
await shot("shots/bao-cao-p2-deposit.png");

await go(BASE + "/game/free-fire");
out.gameMobile = await ev(`() => {
  const f = document.querySelector('.wish-float');
  const banner = document.querySelector('.game-top-banner');
  const btns = f ? [...f.querySelectorAll('.wish-btn')] : [];
  const fr = f?.getBoundingClientRect(); const br = banner?.getBoundingClientRect();
  return {
    inBanner: !!(banner && f && banner.contains(f)),
    btnCount: btns.length,
    labels: btns.map(b => b.textContent.trim()),
    labelVisible: btns.map(b => { const l = b.querySelector('.wish-label'); return l ? getComputedStyle(l).display !== 'none' : null; }),
    atTopRight: fr && br ? (Math.abs(fr.top - br.top) < 22 && Math.abs(fr.right - br.right) < 22) : null,
    headMetaWish: !!document.querySelector('.head-meta .wish-btn')
  };
}`);
await shot("shots/bao-cao-p2-game-mobile.png");

await go(BASE + "/game/free-fire", 1280, 900, false);
out.gameDesktop = await ev(`() => {
  const btns = [...document.querySelectorAll('.wish-float .wish-btn')];
  return { labels: btns.map(b => b.textContent.trim()), labelVisible: btns.map(b => { const l = b.querySelector('.wish-label'); return l ? getComputedStyle(l).display !== 'none' : null; }) };
}`);
await shot("shots/bao-cao-p2-game-desktop.png");

await go(BASE + "/partnership/creator");
out.ptn = await ev(`() => {
  const steps = document.querySelector('.ptn-steps');
  return { direction: steps ? getComputedStyle(steps).flexDirection : null, nums: [...document.querySelectorAll('.ptn-num')].map(n => n.textContent), stepCount: document.querySelectorAll('.ptn-step').length };
}`);
await shot("shots/bao-cao-p2-partnership.png");

for (const path of ["/flash-sale", "/blog", "/blog/chao-mung-bntgame", "/status", "/account/achievements", "/account/orders/FIXQUICK1", "/account/alerts", "/account/profiles"]) {
  await go(BASE + path, 1000, 800, false);
  out["page " + path] = await ev(`() => ({ title: document.title.slice(0, 40), h1: document.querySelector('h1')?.textContent?.slice(0, 40) ?? null, notFound: document.body.innerText.includes('404') && document.body.innerText.length < 400 })`);
}
await go(BASE + "/account/achievements", 1000, 800, false);
await shot("shots/bao-cao-p2-achievements.png");
await go(BASE + "/status", 1000, 800, false);
await shot("shots/bao-cao-p2-status.png");

console.log(JSON.stringify(out, null, 1));
proc.kill();
process.exit(0);
