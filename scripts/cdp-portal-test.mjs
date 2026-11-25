import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const CHROME = "/home/hatch/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const token = readFileSync("/tmp/tok-demo.txt", "utf8").trim();
const proc = spawn(CHROME, ["--headless", "--remote-debugging-port=9365", "--no-sandbox", "--disable-gpu", "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(4000);
const targets = await (await fetch("http://127.0.0.1:9365/json")).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
let seq = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
await send("Network.setCookie", { name: "bnttopup_session", value: token, url: "http://localhost:3107/" });

async function goto(url) {
  await send("Page.navigate", { url });
  await sleep(3000);
}
async function evalJs(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  return r?.result?.value;
}
const text = () => evalJs("document.body.innerText");

// 1. Home
await goto("http://localhost:3107/partner");
let t = await text();
console.log("HOME has partner name:", t.includes("Demo Creator"), "| active campaigns label:", t.includes("Chiến dịch đang tham gia"));

// 2. Campaigns: accept invitation for campaign 2
await goto("http://localhost:3107/partner/campaigns");
t = await text();
console.log("CAMPAIGNS sees invite:", t.includes("Chiến dịch Được Mời"), "| sees accepted:", t.includes("Chiến dịch Test Portal"), "| leaks other:", t.includes("Chiến dịch Của Người Khác"));
const clicked = await evalJs(`(() => {
  const cards = [...document.querySelectorAll("article")];
  const card = cards.find((c) => c.innerText.includes("Chiến dịch Được Mời"));
  if (!card) return "no card";
  const form = [...card.querySelectorAll("form")].find((f) => f.querySelector('input[name="kind"][value="accept"]'));
  if (!form) return "no accept form";
  form.querySelector("button").click();
  return "clicked";
})()`);
console.log("ACCEPT click:", clicked);
await sleep(3500);
console.log("after accept URL:", await evalJs("location.href"));

// 3. Deliverables: submit the PENDING one
await goto("http://localhost:3107/partner/deliverables");
t = await text();
console.log("DELIVERABLES sees pending:", t.includes("Video review game"), "| sees revision note:", t.includes("Cần sửa caption"));
const submitted = await evalJs(`(() => {
  const cards = [...document.querySelectorAll("article")];
  const card = cards.find((c) => c.innerText.includes("Video review game"));
  if (!card) return "no card";
  const form = card.querySelector("form");
  if (!form) return "no form";
  const url = form.querySelector('input[name="url"]');
  url.value = "https://youtube.com/watch?v=test123";
  url.dispatchEvent(new Event("input", { bubbles: true }));
  form.querySelector("button").click();
  return "submitted";
})()`);
console.log("SUBMIT:", submitted);
await sleep(3500);

// 4. Financials
await goto("http://localhost:3107/partner/financials");
t = await text();
console.log("FINANCIALS sees txref:", t.includes("TXTEST123"), "| sees paid status:", t.includes("Đã thanh toán"));

// 5. Isolation: other partner's campaign detail must 404
await goto("http://localhost:3107/partner/campaigns/3");
t = await text();
console.log("ISOLATION other campaign hidden:", !t.includes("Chiến dịch Của Người Khác"), "| url:", await evalJs("location.href"));

proc.kill();
