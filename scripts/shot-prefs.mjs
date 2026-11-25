import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3107";
const CHROME = process.env.HOME + "/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(CHROME, ["--headless", "--no-sandbox", "--remote-debugging-port=9334", "--window-size=1440,1100", "about:blank"], { stdio: "ignore" });
await sleep(1500);
const targets = await (await fetch("http://127.0.0.1:9334/json")).json();
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((res) => (ws.onopen = res));
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Network.enable");
await send("Page.enable");
for (const [name, value] of [["tp_lang", "en"], ["tp_cur", "VND"]]) {
  await send("Network.setCookie", { name, value, url: BASE + "/", path: "/" });
}
await send("Page.navigate", { url: BASE + "/" });
await sleep(3000);
let shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(process.env.HOME + "/workspace/bnt-topup/shots/topup-home-en-vnd-1440-v4.png", Buffer.from(shot.data, "base64"));
await send("Page.navigate", { url: BASE + "/game/free-fire" });
await sleep(3000);
shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(process.env.HOME + "/workspace/bnt-topup/shots/topup-game-en-vnd-1440-v4.png", Buffer.from(shot.data, "base64"));
ws.close();
proc.kill();
console.log("OK prefs screenshots");
