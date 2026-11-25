import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const CHROME = "/home/hatch/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const PORT = 9341;
const TOK = process.env.TOK || "";
const proc = spawn(CHROME, ["--headless", `--remote-debugging-port=${PORT}`, "--no-sandbox", "--disable-gpu", "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
let seq = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
if (TOK) await send("Network.setCookie", { name: "bnttopup_session", value: TOK, domain: "localhost", path: "/", httpOnly: true });
async function nav(url) { await send("Page.navigate", { url }); await sleep(2600); }
async function evl(expr) { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true }); return r?.result?.value; }
async function shot(name) {
  const s = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`shots/${name}`, Buffer.from(s.data, "base64"));
}

await nav("http://localhost:3107/game/free-fire");
const game = await evl(`(() => {
  const badges = [...document.querySelectorAll('.game-top .badge')].map(b => Math.round(b.getBoundingClientRect().height));
  const guide = document.querySelector('.uid-guide-btn');
  const wish = document.querySelector('.wish-btn');
  return { badges, guideH: guide ? Math.round(guide.getBoundingClientRect().height) : null, wishH: wish ? Math.round(wish.getBoundingClientRect().height) : null };
})()`);
console.log("GAME:", JSON.stringify(game));
await shot("bao-cao-fix-tags.png");

await nav("http://localhost:3107/account/deposit");
const dep = await evl(`(() => {
  const wm = document.querySelector('.wl-watermark');
  const svg = document.querySelector('.wl-watermark svg');
  if (!wm) return { wm: null };
  const cs = getComputedStyle(wm);
  return { w: Math.round(svg.getBoundingClientRect().width), transform: cs.transform };
})()`);
console.log("DEPOSIT:", JSON.stringify(dep));
await shot("bao-cao-fix-wallet.png");
proc.kill();
console.log("DONE");
