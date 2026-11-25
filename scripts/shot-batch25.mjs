import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const CHROME = process.env.HOME + "/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const PORT = 9463;
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
  const shot = async (name) => {
    const s = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(process.env.HOME + "/workspace/bnt-topup/shots/" + name, Buffer.from(s.data, "base64"));
    console.log("shot", name);
  };
  const nav = async (url, wait = 2600) => { await send("Page.navigate", { url }); await sleep(wait); };

  await nav("http://localhost:3107/");
  await shot("topup25-home-desktop.png");
  await nav("http://localhost:3107/games");
  await send("Runtime.evaluate", { expression: `document.querySelector('.sortdd-btn')?.click(); true` });
  await sleep(600);
  await shot("topup25-games-desktop.png");
  await nav("http://localhost:3107/game/genshin-impact");
  await shot("topup25-gamename-desktop.png");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await nav("http://localhost:3107/");
  await send("Runtime.evaluate", { expression: `document.querySelector('.prefs-trigger')?.click(); true` });
  await sleep(700);
  await shot("topup25-prefs-mobile.png");
  await nav("http://localhost:3107/games");
  await shot("topup25-games-mobile.png");
  ws.close(); proc.kill();
  console.log("done");
}
main().catch((e) => { console.error(e); proc.kill(); process.exit(1); });
