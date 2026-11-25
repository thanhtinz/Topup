import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";

const CHS = process.env.HOME + "/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const BASE = "http://127.0.0.1:3107";

const token = execFileSync("npx", ["tsx", "scripts/make-token.ts"], { cwd: process.env.HOME + "/workspace/bnt-topup" }).toString().trim().split("\n").pop();

const chrome = spawn(CHS, ["--headless", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=9223", "--window-size=1440,1100", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);

const targets = await (await fetch("http://127.0.0.1:9223/json")).json();
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
};
function send(method, params = {}) {
  return new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
}

await send("Network.enable");
await send("Page.enable");
await send("Network.setCookie", { name: "bnttopup_session", value: token, url: BASE + "/" });
await send("Page.navigate", { url: BASE + "/admin" });
await sleep(3500);
const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(process.env.HOME + "/workspace/bnt-topup/shots/topup-admin-1440-v4.png", Buffer.from(shot.data, "base64"));
await send("Page.navigate", { url: BASE + "/admin/games" });
await sleep(2500);
const shot2 = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(process.env.HOME + "/workspace/bnt-topup/shots/topup-admin-games-1440-v4.png", Buffer.from(shot2.data, "base64"));
await send("Page.navigate", { url: BASE + "/admin/providers" });
await sleep(2500);
const shot3 = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(process.env.HOME + "/workspace/bnt-topup/shots/topup-providers-1440-v2.png", Buffer.from(shot3.data, "base64"));
await send("Page.navigate", { url: BASE + "/admin/providers/FZR" });
await sleep(2500);
const shot4 = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
fs.writeFileSync(process.env.HOME + "/workspace/bnt-topup/shots/topup-provider-fzr-1440-v2.png", Buffer.from(shot4.data, "base64"));
await send("Page.navigate", { url: BASE + "/admin/currencies" });
await sleep(2500);
const shot5 = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
fs.writeFileSync(process.env.HOME + "/workspace/bnt-topup/shots/topup-admin-currencies-1440-v4.png", Buffer.from(shot5.data, "base64"));
console.log("OK admin screenshots");
ws.close();
chrome.kill();
