import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";

const ROOT = process.env.HOME + "/workspace/bnt-topup";
const CHS = process.env.HOME + "/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const BASE = "http://127.0.0.1:3107";
const OUT = ROOT + "/shots/";
const userToken = execFileSync("npx", ["tsx", "scripts/make-user-token.ts"], { cwd: ROOT }).toString().trim().split("\n").pop();

const chrome = spawn(CHS, ["--headless", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=9229", "--window-size=1440,1250", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const targets = await (await fetch("http://127.0.0.1:9229/json")).json();
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const shot = async (name, full = false) => {
  const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full });
  fs.writeFileSync(OUT + name, Buffer.from(s.data, "base64"));
  console.log("shot", name);
};
await send("Network.enable");
await send("Page.enable");
await send("Network.setCookie", { name: "bnttopup_session", value: userToken, url: BASE + "/" });

await send("Page.navigate", { url: BASE + "/account" });
await sleep(3000);
await shot("topup-profile-1440-v1.png", true);
await send("Page.navigate", { url: BASE + "/account/orders?g=done" });
await sleep(2500);
await shot("topup-orders-done-1440-v1.png");

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: BASE + "/account" });
await sleep(3000);
await shot("topup-profile-390-v1.png", true);

ws.close();
chrome.kill();
