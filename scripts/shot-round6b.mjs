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

await send("Page.navigate", { url: BASE + "/game/free-fire" });
await sleep(3000);
await shot("tmp-ff.png");

await ev(`document.querySelector('.uid-guide-btn')?.click()`);
await sleep(900);
await shot("tmp-modal.png");
await ev(`document.querySelector('.modal-x')?.click()`);

await send("Page.navigate", { url: BASE + "/admin/games/1/packages" });
await sleep(3000);
const m = await ev(`(() => { const img = document.querySelector('input[name^="img_"]'); const name = document.querySelector('input[name^="name_"]'); if (!img || !name) return null; const a = name.getBoundingClientRect(), b = img.getBoundingClientRect(); return { nameX: Math.round(a.x), imgX: Math.round(b.x), nameY: Math.round(a.y), imgY: Math.round(b.y) }; })()`);
console.log("ô tên/ảnh gói:", JSON.stringify(m), "(đúng khi imgX = nameX và imgY > nameY)");
await ev(`document.querySelector('input[name^="name_"]')?.scrollIntoView({block:'center'})`);
await sleep(700);
await shot("topup-admin-game-packages-1440-v3.png");

ws.close();
chrome.kill();
