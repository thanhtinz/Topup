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
const countFF = async () => {
  const html = await (await fetch(BASE + "/games")).text();
  return (html.match(/Free Fire/g) || []).length;
};

await send("Network.enable");
await send("Page.enable");
await send("Network.setCookie", { name: "bnttopup_session", value: token, url: BASE + "/" });

console.log("Free Fire ở /games KHI CHƯA DUYỆT:", await countFF(), "(mong đợi 0 — đang ẩn)");
const ffStatus = await (await fetch(BASE + "/game/free-fire")).status;
console.log("HTTP trang game Free Fire khi chưa duyệt:", ffStatus, "(mong đợi 404)");

await send("Page.navigate", { url: BASE + "/admin/compare" });
await sleep(3000);
await shot("topup-admin-compare-1440-v4.png");

await ev(`(() => { const rows = [...document.querySelectorAll('tr')]; const ff = rows.find(r => r.textContent.includes('Free Fire')); const btn = [...(ff?.querySelectorAll('button') ?? [])].find(b => b.textContent.trim() === 'Duyệt'); btn?.click(); return btn?.textContent; })()`);
await sleep(3000);
console.log("Free Fire ở /games SAU KHI DUYỆT:", await countFF(), "(mong đợi > 0 — đã hiện)");
await send("Page.navigate", { url: BASE + "/admin/compare" });
await sleep(2500);
await shot("tmp-v3.png");

ws.close();
chrome.kill();
