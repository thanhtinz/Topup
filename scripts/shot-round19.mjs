import { execFileSync, spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const ROOT = process.env.HOME + "/workspace/bnt-topup";
const CHS = process.env.HOME + "/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const BASE = "http://127.0.0.1:3107";
const userToken = execFileSync("npx", ["tsx", "scripts/make-user-token.ts"], { cwd: ROOT }).toString().trim().split("\n").pop();
const chrome = spawn(CHS, ["--headless", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=9245", "--window-size=1440,1100", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const targets = await (await fetch("http://127.0.0.1:9245/json")).json();
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.enable"); await send("Network.enable"); await send("Runtime.enable");
async function metrics(w, mobile = false) { await send("Emulation.setDeviceMetricsOverride", { width: w, height: 1050, deviceScaleFactor: 1, mobile }); await sleep(400); }
async function shot(name, beyond = false) { const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: beyond }); writeFileSync(`${ROOT}/shots/${name}`, Buffer.from(r.data, "base64")); console.log("shot", name); }
async function go(url) { await send("Page.navigate", { url: BASE + url }); await sleep(2300); }
async function evalJs(expr) { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true }); await sleep(900); return r.result.value; }

await go("/");
await evalJs(`document.querySelector('.prefs-trigger')?.click()`);
await shot("topup-prefs-card-1440.png");
await evalJs(`document.querySelector('.prefs-veil')?.click()`);
await evalJs(`[...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Đăng nhập')?.click()`);
await shot("topup-auth-popup-v8-social.png");
await metrics(390, true);
await go("/");
await shot("topup-home-under-search-390.png");
await evalJs(`document.querySelector('.prefs-trigger')?.click()`);
await shot("topup-prefs-card-390.png");
await send("Network.setCookie", { name: "bnttopup_session", value: userToken, url: BASE + "/" });
await go("/account/referral");
await shot("topup-referral-v5-390.png", true);
chrome.kill();
process.exit(0);
