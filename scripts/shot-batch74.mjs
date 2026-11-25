import { spawn } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";

const CHROME = "/home/hatch/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const PORT = 9342;
const DEMO = readFileSync("/tmp/tok-demo.txt", "utf8").trim();
const ADMIN = readFileSync("/tmp/tok-admin.txt", "utf8").trim();
const proc = spawn(CHROME, ["--headless", `--remote-debugging-port=${PORT}`, "--no-sandbox", "--disable-gpu", "--window-size=390,844", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
let seq = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
async function nav(url, cookie) {
  if (cookie) await send("Network.setCookie", { name: "bnttopup_session", value: cookie, domain: "localhost", path: "/", httpOnly: true });
  await send("Page.navigate", { url });
  await sleep(2800);
}
async function evl(expr) { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true }); return r?.result?.value; }
async function shot(name) { const s = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`shots/${name}`, Buffer.from(s.data, "base64")); }

await nav("http://localhost:3107/game/free-fire");
const badges = await evl(`(() => {
  const bs = [...document.querySelectorAll('.head-meta .badge')];
  return { n: bs.length, tops: bs.map(b => Math.round(b.getBoundingClientRect().top)), widths: bs.map(b => Math.round(b.getBoundingClientRect().width)) };
})()`);
console.log("BADGES mobile 390px:", JSON.stringify(badges), badges.tops.every(t => t === badges.tops[0]) ? "ONE-LINE PASS" : "WRAP FAIL");
await evl(`document.querySelector('.head-meta')?.scrollIntoView({block:'center'})`);
await sleep(500);
await shot("bao-cao-74-tags-mobile.png");

await nav("http://localhost:3107/account/api-keys", DEMO);
await shot("bao-cao-74-api-keys.png");

await nav("http://localhost:3107/api-docs");
await shot("bao-cao-74-api-docs.png");

await nav("http://localhost:3107/admin/blog", ADMIN);
await sleep(1500);
const rte = await evl(`(() => ({ toolbar: !!document.querySelector('.rte-toolbar'), btns: document.querySelectorAll('.rte-btn').length, editor: !!document.querySelector('.rte-content .tiptap') }))()`);
console.log("RTE:", JSON.stringify(rte), rte.toolbar && rte.editor ? "PASS" : "FAIL");
await shot("bao-cao-74-blog-editor.png");
proc.kill();
console.log("DONE");
