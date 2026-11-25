import { spawn, execFileSync } from "node:child_process";

const BASE = "http://127.0.0.1:3107";
const CHROME = process.env.HOME + "/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const token = execFileSync("npx", ["tsx", "scripts/make-token.ts"], { cwd: process.env.HOME + "/workspace/bnt-topup", encoding: "utf8" }).trim();

const proc = spawn(CHROME, ["--headless", "--no-sandbox", "--remote-debugging-port=9337", "--window-size=1440,1000", "about:blank"], { stdio: "ignore" });
await sleep(1500);
const targets = await (await fetch("http://127.0.0.1:9337/json")).json();
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((res) => (ws.onopen = res));
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true }))?.result?.value;

await send("Network.enable"); await send("Page.enable");
await send("Network.setCookie", { name: "bnttopup_session", value: token, url: BASE + "/", path: "/" });
await send("Page.navigate", { url: BASE + "/admin/games/1/packages" });
await sleep(3000);
const report = await ev(`(() => {
  const img0 = document.querySelector('input[name^="img_"]');
  const chain = [];
  let n = img0;
  for (let i = 0; i < 5 && n; i++) { chain.push(n.tagName + '.' + (n.className || '') + ' disp=' + getComputedStyle(n).display + ' pos=' + getComputedStyle(n).position); n = n.parentElement; }
  return JSON.stringify({ chain, parentHTML: img0.parentElement.outerHTML.slice(0, 400) }, null, 1);
})()`);
console.log(report);
const report2 = await ev(`(() => {
  const wrap = document.querySelector('.table-wrap');
  const table = document.querySelector('.table-wrap table');
  const price = document.querySelector('input[name^="price_"]');
  const cost = document.querySelector('input[name^="cost_"]');
  const name = document.querySelector('input[name^="name_"]');
  const img = document.querySelector('input[name^="img_"]');
  const td = name.closest('td');
  const flexDiv = name.parentElement.parentElement;
  const r = (el) => { const b = el.getBoundingClientRect(); return { w: Math.round(b.width), x: Math.round(b.x), clientW: el.clientWidth, scrollW: el.scrollWidth }; };
  return JSON.stringify({
    wrapClientW: wrap.clientWidth, wrapScrollW: wrap.scrollWidth, wrapScrollLeft: wrap.scrollLeft,
    tableW: Math.round(table.getBoundingClientRect().width),
    price: r(price), cost: r(cost), name: r(name),
    img: r(img), tdW: Math.round(td.getBoundingClientRect().width), flexW: Math.round(flexDiv.getBoundingClientRect().width), nameParentW: Math.round(name.parentElement.getBoundingClientRect().width),
    priceValue: price.value, innerW: window.innerWidth,
  }, null, 1);
})()`);
console.log(report2);
ws.close(); proc.kill();
