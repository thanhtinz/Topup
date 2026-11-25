import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const CHROME = "/home/hatch/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const PORT = 9381;
const URL = process.argv[2] || "http://127.0.0.1:3107/game/telegram";
const TAG = process.argv[3] || "fix";
import { readFileSync } from "node:fs";
const TOKFILE = process.argv[4] || "";
const proc = spawn(CHROME, ["--headless", "--disable-gpu", "--no-sandbox", `--remote-debugging-port=${PORT}`, "--window-size=390,844", "about:blank"], { stdio: "ignore" });
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
await S("Network.setCookie", { name: "tp_cur", value: "VND", domain: "127.0.0.1", path: "/" });
if (TOKFILE) { const tok = readFileSync(TOKFILE, "utf8").trim().split("\n").pop(); await S("Network.setCookie", { name: "bnttopup_session", value: tok, domain: "127.0.0.1", path: "/" }); }
await S("Network.setCookie", { name: "tp_lang", value: "vi", domain: "127.0.0.1", path: "/" });
await S("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await S("Page.navigate", { url: URL });
await sleep(3500);
const probe = await S("Runtime.evaluate", { expression: `JSON.stringify({ iw: window.innerWidth, sw: document.documentElement.scrollWidth, priceOver: [...document.querySelectorAll('.pkg-price')].map(p => p.scrollWidth - p.clientWidth).filter(x => x > 0), wide: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).length })`, returnByValue: true });
console.log("PROBE:", probe?.result?.value);
async function shotAt(y, file) {
  await S("Runtime.evaluate", { expression: `window.scrollTo(0, ${y})` });
  await sleep(700);
  const { data } = await S("Page.captureScreenshot", { format: "png" });
  writeFileSync(file, Buffer.from(data, "base64"));
  console.log("shot", file);
}
await shotAt(0, `shots/${TAG}-0.png`);
await shotAt(700, `shots/${TAG}-700.png`);
await shotAt(1500, `shots/${TAG}-1500.png`);
proc.kill();
process.exit(0);
