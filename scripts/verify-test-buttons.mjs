import { execFileSync, spawn } from "node:child_process";

const ROOT = process.env.HOME + "/workspace/bnt-topup";
const CHS = process.env.HOME + "/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const BASE = "http://127.0.0.1:3107";
const adminToken = execFileSync("npx", ["tsx", "scripts/make-token.ts"], { cwd: ROOT }).toString().trim().split("\n").pop();

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
await send("Network.enable");
await send("Page.enable");
await send("Network.setCookie", { name: "bnttopup_session", value: adminToken, url: BASE + "/" });

const clickTest = async (tab) => {
  await send("Page.navigate", { url: `${BASE}/admin/payments?tab=${tab}` });
  await sleep(2500);
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Kiểm tra kết nối')); b?.click(); return !!b; })()`);
  await sleep(tab === "bntpay" ? 25000 : 6000);
  return ev(`(() => { const ok = document.querySelector('.msg-ok, .form-ok'); const err = document.querySelector('.msg-err, .form-err'); return (ok?.textContent || err?.textContent || '(không thấy thông báo)').trim(); })()`);
};

console.log("SePay test:", await clickTest("sepay"));
console.log("BNT Pay test:", await clickTest("bntpay"));

ws.close();
chrome.kill();
