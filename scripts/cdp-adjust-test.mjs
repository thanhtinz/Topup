import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const CHROME = "/home/hatch/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const tokenFile = process.argv[2];
const label = process.argv[3];
const kind = process.argv[4] || "add";
const token = readFileSync(tokenFile, "utf8").trim();

const proc = spawn(CHROME, ["--headless", "--remote-debugging-port=9361", "--no-sandbox", "--disable-gpu", "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2500);
const targets = await (await fetch("http://127.0.0.1:9361/json")).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
let seq = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
await send("Network.setCookie", { name: "bnttopup_session", value: token, url: "http://localhost:3107/" });
await send("Page.navigate", { url: "http://localhost:3107/admin/users" });
await sleep(3000);
const r = await send("Runtime.evaluate", {
  expression: `(() => {
    const rows = [...document.querySelectorAll("tr, .admin-card, div")];
    const row = rows.find((el) => el.querySelector && [...el.querySelectorAll("form")].length >= 2 && el.textContent.includes("demo@bnttopup.local") && el.querySelector('input[name="kind"][value="${kind}"]'));
    if (!row) return { err: "row not found", url: location.href, title: document.title };
    const form = [...row.querySelectorAll("form")].find((f) => f.querySelector('input[name="kind"][value="${kind}"]'));
    const amount = form.querySelector('input[name="amount"]');
    if (!amount) return { err: "amount input not found" };
    amount.value = "1.00";
    amount.dispatchEvent(new Event("input", { bubbles: true }));
    const btn = form.querySelector('button[type="submit"], button');
    if (btn) btn.click(); else form.requestSubmit();
    return { submitted: true };
  })()`,
  returnByValue: true,
});
console.log(label, "submit:", JSON.stringify(r?.result?.value));
await sleep(3500);
const loc = await send("Runtime.evaluate", { expression: "location.href", returnByValue: true });
console.log(label, "final URL:", loc?.result?.value);
proc.kill();
