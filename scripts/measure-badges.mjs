import { spawn } from "node:child_process";
const CHROME = "/home/hatch/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function check(w, port) {
  const proc = spawn(CHROME, ["--headless", `--remote-debugging-port=${port}`, "--no-sandbox", "--disable-gpu", `--window-size=${w},844`, "about:blank"], { stdio: "ignore" });
  await sleep(2500);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  let seq = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
  await new Promise((r) => (ws.onopen = r));
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.navigate", { url: "http://localhost:3107/game/free-fire" });
  await sleep(2600);
  const r = await send("Runtime.evaluate", { expression: `(() => {
    const bs = [...document.querySelectorAll('.head-meta .badge')];
    const guide = document.querySelector('.uid-guide-btn');
    return { cw: document.documentElement.clientWidth, font: getComputedStyle(bs[0]).fontSize, n: bs.length, tops: bs.map(b => Math.round(b.getBoundingClientRect().top)), widths: bs.map(b => Math.round(b.getBoundingClientRect().width)), svgs: bs.map(b => b.querySelectorAll('svg').length), guideH: guide ? Math.round(guide.getBoundingClientRect().height) : null, badgeH: bs[0] ? Math.round(bs[0].getBoundingClientRect().height) : null };
  })()`, returnByValue: true });
  const v = r?.result?.value;
  console.log(`W=${w}:`, JSON.stringify(v), v.tops.every(t => t === v.tops[0]) ? "ONE-LINE PASS" : "WRAP FAIL");
  proc.kill();
}
await check(390, 9351);
await check(360, 9352);
