import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const CHROME = "/home/hatch/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const PORT = 9305;
const proc = spawn(CHROME, ["--headless", "--disable-gpu", "--no-sandbox", `--remote-debugging-port=${PORT}`, "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
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
await S("Network.setCookie", { name: "bnttopup_session", value: process.env.TOKEN, domain: "127.0.0.1", path: "/" });
async function shot(url, file, w = 1280, h = 900, clickBurger = false) {
  await S("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
  await S("Page.navigate", { url });
  await sleep(2600);
  if (clickBurger) { await S("Runtime.evaluate", { expression: `document.querySelector('.admin-burger')?.click()` }); await sleep(700); }
  const { data } = await S("Page.captureScreenshot", { format: "png" });
  writeFileSync(file, Buffer.from(data, "base64"));
  console.log("saved", file);
}
const B = "http://127.0.0.1:3107";
await shot(`${B}/admin/providers/ERIS`, "shots/admin-sync-done-1280.png");
await shot(`${B}/game/genshin-impact`, "shots/game-uid-fields-390.png", 390, 1000);

ws.close(); proc.kill();
