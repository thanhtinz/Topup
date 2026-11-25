import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3107";
const CHROME = process.env.HOME + "/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const token = execFileSync("npx", ["tsx", "scripts/make-token.ts"], { cwd: process.env.HOME + "/workspace/bnt-topup", encoding: "utf8" }).trim();

const proc = spawn(CHROME, ["--headless", "--no-sandbox", "--remote-debugging-port=9335", "--window-size=1440,1000", "about:blank"], { stdio: "ignore" });
await sleep(1500);
const targets = await (await fetch("http://127.0.0.1:9335/json")).json();
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((res) => (ws.onopen = res));
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true }))?.result?.value;

await send("Network.enable"); await send("Page.enable");
await send("Network.setCookie", { name: "bnttopup_session", value: token, url: BASE + "/", path: "/" });
await send("Page.navigate", { url: BASE + "/admin/games" });
await sleep(2500);
const state = () => ev(`document.querySelector('tbody tr .switch input')?.checked`);
console.log("ban đầu (Free Fire):", await state());
await ev(`document.querySelector('tbody tr .switch input').click()`);
await sleep(2500);
await send("Page.navigate", { url: BASE + "/admin/games" });
await sleep(2500);
console.log("sau khi tắt + reload:", await state());
await ev(`document.querySelector('tbody tr .switch input').click()`);
await sleep(2500);
await send("Page.navigate", { url: BASE + "/admin/games" });
await sleep(2500);
console.log("sau khi bật lại + reload:", await state());
ws.close(); proc.kill();
