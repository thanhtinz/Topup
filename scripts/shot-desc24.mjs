import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const CHROME = process.env.HOME + "/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const PORT = 9461;
const proc = spawn(CHROME, ["--headless", "--disable-gpu", "--no-sandbox", `--remote-debugging-port=${PORT}`, "--window-size=1280,1100", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  await sleep(1200);
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable");
  await send("Page.navigate", { url: "http://localhost:3107/game/genshin-impact" });
  await sleep(3200);
  await send("Runtime.evaluate", { expression: `document.querySelector('.desc-card')?.scrollIntoView({block:'start'}); window.scrollBy(0,-70); true` });
  await sleep(600);
  let shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(process.env.HOME + "/workspace/bnt-topup/shots/topup24-desc-closed.png", Buffer.from(shot.data, "base64"));
  await send("Runtime.evaluate", { expression: `document.querySelector('.desc-head')?.click(); true` });
  await sleep(700);
  shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(process.env.HOME + "/workspace/bnt-topup/shots/topup24-desc-open.png", Buffer.from(shot.data, "base64"));
  await send("Runtime.evaluate", { expression: `document.querySelector('.rv-card')?.scrollIntoView({block:'center'}); true` });
  await sleep(600);
  shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(process.env.HOME + "/workspace/bnt-topup/shots/topup24-reviewcard.png", Buffer.from(shot.data, "base64"));
  ws.close(); proc.kill();
  console.log("shots done");
}
main().catch((e) => { console.error(e); proc.kill(); process.exit(1); });
