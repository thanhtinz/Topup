import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const CHROME = "/home/hatch/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const token = readFileSync("/tmp/tok-demo.txt", "utf8").trim();

const proc = spawn(CHROME, ["--headless", "--remote-debugging-port=9363", "--no-sandbox", "--disable-gpu", "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(4000);
const targets = await (await fetch("http://127.0.0.1:9363/json")).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
let seq = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
await send("Network.setCookie", { name: "bnttopup_session", value: token, url: "http://localhost:3107/" });

async function readRef() {
  const r = await send("Runtime.evaluate", {
    expression: `(() => { const el = document.querySelector('input[name="clientRef"]'); return el ? el.value : null; })()`,
    returnByValue: true,
  });
  return r?.result?.value ?? null;
}

await send("Page.navigate", { url: "http://localhost:3107/game/free-fire" });
await sleep(3500);
const ref1 = await readRef();
await send("Page.reload", {});
await sleep(3500);
const ref2 = await readRef();
console.log(`first=${ref1}`);
console.log(`after reload=${ref2}`);
console.log("reload keeps ref:", ref1 && ref1 === ref2 ? "OK" : "FAIL");

await send("Page.navigate", { url: "http://localhost:3107/account/orders" });
await sleep(3000);
await send("Page.navigate", { url: "http://localhost:3107/game/free-fire" });
await sleep(3500);
const ref3 = await readRef();
console.log(`after orders visit=${ref3}`);
console.log("cleared after success page:", ref3 && ref3 !== ref1 ? "OK" : "FAIL");
proc.kill();
