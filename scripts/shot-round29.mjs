import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const CHROME = process.env.HOME + "/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const PORT = 9279;
const TOKEN = process.env.TOKEN || "";
const proc = spawn(CHROME, ["--headless", "--disable-gpu", "--no-sandbox", `--remote-debugging-port=${PORT}`, "--window-size=390,844", "about:blank"], { stdio: "ignore" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); break; } catch { await wait(300); } }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable");
  await send("Network.enable");
  await send("Network.setCookie", { name: "bnttopup_session", value: TOKEN, url: "http://127.0.0.1:3107/" });
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Page.navigate", { url: "http://127.0.0.1:3107/account" });
  await wait(1600);
  const audit = await send("Runtime.evaluate", { expression: `(() => {
    const out = [];
    document.querySelectorAll('.pf-perk, .pf-perks, .pf-banner, .pf-banner-top, .pf-banner-btn').forEach((el) => {
      out.push({ cls: el.className, client: el.clientWidth, scroll: el.scrollWidth, over: el.scrollWidth - el.clientWidth, text: (el.textContent || '').trim().slice(0, 40) });
    });
    const all = [];
    document.querySelectorAll('.pf-card *').forEach((el) => { if (el.scrollWidth > el.clientWidth + 1) all.push({ cls: el.className || el.tagName, client: el.clientWidth, scroll: el.scrollWidth, text: (el.textContent || '').trim().slice(0, 30) }); });
    return JSON.stringify({ perks: out, offenders: all.slice(0, 8) });
  })()`, returnByValue: true });
  console.log(audit.result?.value ?? JSON.stringify(audit));
  ws.close(); proc.kill();
}
main().catch((e) => { console.error(e); proc.kill(); process.exit(1); });
