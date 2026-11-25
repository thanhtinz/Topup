import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";

const CHS = process.env.HOME + "/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const BASE = "http://127.0.0.1:3107";
const OUT = process.env.HOME + "/workspace/bnt-topup/shots/";
const token = execFileSync("npx", ["tsx", "scripts/make-token.ts"], { cwd: process.env.HOME + "/workspace/bnt-topup" }).toString().trim().split("\n").pop();

const chrome = spawn(CHS, ["--headless", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=9229", "--window-size=1440,1100", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const targets = await (await fetch("http://127.0.0.1:9229/json")).json();
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true }))?.result?.value;
const shot = async (name) => {
  const s = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(OUT + name, Buffer.from(s.data, "base64"));
  console.log("shot", name);
};

await send("Network.enable");
await send("Page.enable");
await send("Network.setCookie", { name: "bnttopup_session", value: token, url: BASE + "/" });

await send("Page.navigate", { url: BASE + "/admin/games" });
await sleep(3000);
await shot("topup-admin-games-1440-v6.png");

await send("Page.navigate", { url: BASE + "/admin/games/new" });
await sleep(2500);
await shot("topup-admin-game-new-1440-v1.png");

await send("Page.navigate", { url: BASE + "/admin/compare" });
await sleep(3000);
await shot("topup-admin-compare-1440-v1.png");

await send("Page.navigate", { url: BASE + "/game/free-fire" });
await sleep(3000);
const balCount = await ev(`[...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && e.textContent.trim() === 'Số dư ví của bạn').length`);
console.log("số chỗ hiện nhãn 'Số dư ví của bạn' trong trang game:", balCount, "(mong đợi 0)");
await shot("topup-game-ff-balance-1440-v1.png");

ws.close();
chrome.kill();
