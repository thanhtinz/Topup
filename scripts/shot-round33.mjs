import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const CHROME = process.env.HOME + "/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const PORT = 9283;
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
  await send("Page.navigate", { url: "http://127.0.0.1:3107/account/vip" });
  await wait(1600);
  const h = await send("Runtime.evaluate", { expression: "document.body.scrollHeight", returnByValue: true });
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: Math.min(Number(h.result?.value) || 844, 2400), deviceScaleFactor: 2, mobile: true });
  await wait(500);
  const s = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync("shots/topup-vip-compact-390.png", Buffer.from(s.data, "base64"));
  console.log("saved, pageH:", h.result?.value);
  ws.close(); proc.kill();
}
main().catch((e) => { console.error(e); proc.kill(); process.exit(1); });
