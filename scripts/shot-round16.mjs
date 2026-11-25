import { execFileSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
const ROOT = process.env.HOME + "/workspace/bnt-topup";
const CHS = process.env.HOME + "/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const BASE = "http://127.0.0.1:3107";
mkdirSync(ROOT + "/shots", { recursive: true });
const adminToken = execFileSync("npx", ["tsx", "scripts/make-token.ts"], { cwd: ROOT }).toString().trim().split("\n").pop();
const userToken = execFileSync("npx", ["tsx", "scripts/make-user-token.ts"], { cwd: ROOT }).toString().trim().split("\n").pop();
const chrome = spawn(CHS, ["--headless", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=9234", "--window-size=1440,1100", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const targets = await (await fetch("http://127.0.0.1:9234/json")).json();
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.enable"); await send("Network.enable"); await send("Runtime.enable");
async function shot(name, w = 1440) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 1050, deviceScaleFactor: 1, mobile: w < 600 });
  await sleep(500);
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const { writeFileSync } = await import("node:fs");
  writeFileSync(`${ROOT}/shots/${name}`, Buffer.from(r.data, "base64"));
  console.log("shot", name);
}
async function go(url) { await send("Page.navigate", { url: BASE + url }); await sleep(2400); }
async function clickText(txt) {
  const expr = `(() => { const els = [...document.querySelectorAll('button, a')]; const el = els.find(e => e.textContent.trim() === ${JSON.stringify(txt)}); if (el) { el.click(); return 'ok'; } return 'notfound'; })()`;
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  console.log("click", txt, "->", r.result.value);
  await sleep(1100);
}
await go("/");
await clickText("Đăng nhập");
await shot("topup-auth-popup-v3-1440.png");
await clickText("Đăng ký");
await shot("topup-auth-popup-v3-register.png");
await send("Network.clearBrowserCookies");
await send("Network.setCookie", { name: "bnttopup_session", value: userToken, url: BASE + "/" });
await go("/account/orders"); await shot("topup-orders-v2-1440.png");
await shot("topup-orders-v2-390.png", 390);
await go("/discounts"); await shot("topup-discounts-v2-1440.png", 1440);
await go("/account/referral"); await shot("topup-referral-v2-1440.png");
await send("Network.setCookie", { name: "bnttopup_session", value: adminToken, url: BASE + "/" });
await go("/admin/vip"); await shot("topup-admin-vip-v2-1440.png");
ws.close(); chrome.kill();
