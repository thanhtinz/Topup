import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";

const ROOT = process.env.HOME + "/workspace/bnt-topup";
const CHS = process.env.HOME + "/workspace/tools/pptr-browsers/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell";
const BASE = "http://127.0.0.1:3107";
const OUT = ROOT + "/shots/";
const adminToken = execFileSync("npx", ["tsx", "scripts/make-token.ts"], { cwd: ROOT }).toString().trim().split("\n").pop();
const userToken = execFileSync("npx", ["tsx", "scripts/make-user-token.ts"], { cwd: ROOT }).toString().trim().split("\n").pop();

const chrome = spawn(CHS, ["--headless", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=9231", "--window-size=1440,1200", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const targets = await (await fetch("http://127.0.0.1:9231/json")).json();
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) console.log("EVAL ERR:", r.exceptionDetails.text, expr.slice(0, 80));
  return r.result?.value;
};
const shot = async (name) => {
  const s = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(OUT + name, Buffer.from(s.data, "base64"));
  console.log("shot", name);
};
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`); if (!ok) fails++; };
await send("Network.enable");
await send("Page.enable");
const setCookie = (v) => send("Network.setCookie", { name: "bnttopup_session", value: v, url: BASE + "/" });
const nav = async (url, wait = 2200) => { await send("Page.navigate", { url: BASE + url }); await sleep(wait); };

await setCookie(adminToken);
await nav("/admin/compare", 3000);
await ev(`window.__mark = "ALIVE19"`);
const selInfo = await ev(`(() => {
  const rows = [...document.querySelectorAll("tr")];
  const row = rows.find((r) => r.textContent.includes("Test Merge"));
  if (!row) return "NO_ROW";
  const sel = row.querySelector("select");
  if (!sel) return "NO_SELECT";
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
  setter.call(sel, "FZR_ONLY");
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  return "CHANGED";
})()`);
check("compare: tìm thấy hàng Test Merge + đổi select", selInfo === "CHANGED", String(selInfo));
await sleep(1800);
const markAfter = await ev(`window.__mark`);
check("compare: trang KHÔNG reload sau khi đổi nguồn", markAfter === "ALIVE19", String(markAfter));
const savedTxt = await ev(`(() => { const row = [...document.querySelectorAll("tr")].find((r) => r.textContent.includes("Test Merge")); return row ? row.textContent : ""; })()`);
check("compare: hiện 'Đã lưu' tại hàng", String(savedTxt).includes("Đã lưu"));
const approveClick = await ev(`(() => {
  const row = [...document.querySelectorAll("tr")].find((r) => r.textContent.includes("Test Merge"));
  const btn = [...row.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith("Duyệt"));
  if (!btn) return "NO_BTN";
  btn.click();
  return "CLICKED";
})()`);
await sleep(1500);
const rowAfter = await ev(`(() => { const row = [...document.querySelectorAll("tr")].find((r) => r.textContent.includes("Test Merge")); return row ? row.textContent : ""; })()`);
check("compare: bấm Duyệt lật trạng thái tại chỗ", approveClick === "CLICKED" && String(rowAfter).includes("Đã duyệt"), String(approveClick));
const markAfter2 = await ev(`window.__mark`);
check("compare: vẫn không reload sau duyệt", markAfter2 === "ALIVE19");
await shot("topup19-compare-1440.png");

await setCookie(userToken);
await nav("/game/test-merge", 2800);
const uidFields = await ev(`document.body.innerText.includes("UID") && document.body.innerText.includes("Server")`);
check("game: mặc định hiện trường UID/Server", uidFields === true);
const loginClick = await ev(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Global"); if (!b) return "NO"; b.click(); return "OK"; })()`);
await sleep(700);
const loginForm = await ev(`document.body.innerText`);
check("game: chọn khu vực Global -> hình thức Login, hiện trường Tài khoản/Mật khẩu", loginClick === "OK" && String(loginForm).includes("Tài khoản") && String(loginForm).includes("Mật khẩu"));
check("game: trường contact hiện nhãn Messenger/Telegram", String(loginForm).includes("Link Messenger hoặc Telegram"));
await shot("topup19-game-login-1440.png");

await nav("/support", 2500);
const fill = await ev(`(() => {
  const s = document.querySelector("#tk-subject"); const b = document.querySelector("#tk-body");
  if (!s || !b) return "NO_FORM";
  const set = (el, v) => { const p = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };
  set(s, "Đơn nạp chưa vào game"); set(b, "Em nạp gói 100 Diamonds mà chưa thấy vào game ạ.");
  return "FILLED";
})()`);
check("support: thấy form tạo ticket", fill === "FILLED", String(fill));
await ev(`document.querySelector('form button[type="submit"]')?.click()`);
await sleep(3000);
const threadUrl = await ev(`location.pathname`);
check("ticket: tạo xong chuyển tới trang thread", String(threadUrl).startsWith("/account/tickets/TK"), String(threadUrl));
await shot("topup19-ticket-thread-user.png");

await setCookie(adminToken);
await nav("/admin/tickets", 2500);
const listTxt = await ev(`document.body.innerText`);
check("admin tickets: thấy ticket vừa tạo + đếm chờ hỗ trợ", String(listTxt).includes("Đơn nạp chưa vào game") && String(listTxt).includes("Chờ hỗ trợ"));
await shot("topup19-admin-tickets.png");
await ev(`[...document.querySelectorAll("a")].find((a) => a.textContent.trim() === "Mở")?.click()`);
await sleep(2500);
const fillReply = await ev(`(() => {
  const b = document.querySelector("#adm-tk-reply");
  if (!b) return "NO_FORM";
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(b, "Chào bạn, đội hỗ trợ đã kiểm tra và nạp lại thành công. Bạn vào game kiểm tra giúp nhé.");
  b.dispatchEvent(new Event("input", { bubbles: true }));
  [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Gửi trả lời"))?.click();
  return "SENT";
})()`);
await sleep(3000);
const detailTxt = await ev(`document.body.innerText`);
check("admin: trả lời xong, trạng thái Đã trả lời", fillReply === "SENT" && String(detailTxt).includes("Đã trả lời"));
await shot("topup19-admin-ticket-detail.png");
await ev(`[...document.querySelectorAll("button")].find((x) => x.textContent.includes("Đóng ticket"))?.click()`);
await sleep(2500);
const closedTxt = await ev(`document.body.innerText`);
check("admin: đóng ticket xong", String(closedTxt).includes("Đã đóng"));

await setCookie(userToken);
await nav(String(threadUrl), 2500);
const userThread = await ev(`document.body.innerText`);
check("khách: thấy trả lời của đội hỗ trợ + ticket đã đóng", String(userThread).includes("nạp lại thành công") && String(userThread).includes("Đã đóng"));
await shot("topup19-ticket-thread-done.png");

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await nav("/account/orders", 2800);
const boxes = await ev(`(() => { const d = [...document.querySelectorAll('input[type="date"]')]; return d.map((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }); })()`);
console.log("date boxes:", JSON.stringify(boxes));
const noOverlap = Array.isArray(boxes) && boxes.length === 2 && (boxes[0].y + boxes[0].h <= boxes[1].y + 1 || boxes[1].y + boxes[1].h <= boxes[0].y + 1 || boxes[0].x + boxes[0].w <= boxes[1].x + 1 || boxes[1].x + boxes[1].w <= boxes[0].x + 1) && boxes.every((b) => b.x + b.w <= 392);
check("orders 390px: 2 ô ngày không chồng, không tràn", noOverlap === true);
await shot("topup19-orders-390.png");

await nav("/account", 2800);
const prof = await ev(`(() => {
  const tabs = [...document.querySelectorAll(".tabbar a")].map((a) => a.getAttribute("href"));
  const walletLink = [...document.querySelectorAll('a[href="/account/deposit"]')].length;
  return { tabs, walletLink };
})()`);
check("tab bar mobile có 5 mục gồm Nạp tiền", Array.isArray(prof?.tabs) && prof.tabs.length === 5 && prof.tabs.includes("/account/deposit"), JSON.stringify(prof?.tabs));
check("profile + header có lối bấm vào nạp ví", (prof?.walletLink ?? 0) >= 2, `thấy ${prof?.walletLink}`);
await shot("topup19-profile-390.png");

console.log(fails === 0 ? "ALL PASS" : `${fails} FAIL`);
ws.close();
chrome.kill();
process.exit(fails ? 1 : 0);
