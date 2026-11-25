import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const CHROME = process.env.HOME + "/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const PORT = 9465;
const proc = spawn(CHROME, ["--headless", "--disable-gpu", "--no-sandbox", `--remote-debugging-port=${PORT}`, "--window-size=1280,1000", "about:blank"], { stdio: "ignore" });
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
  await send("Page.navigate", { url: "http://localhost:3107/games" });
  await sleep(3000);
  const s = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(process.env.HOME + "/workspace/bnt-topup/shots/topup26-games-square.png", Buffer.from(s.data, "base64"));
  ws.close(); proc.kill();
  console.log("ok");
}
main().catch((e) => { console.error(e); proc.kill(); process.exit(1); });
