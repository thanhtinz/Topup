import "./env";
import assert from "node:assert";
import { priceWithMarkup, fmtUSD, fmtVND, parseMoneyToCents } from "../src/lib/money";
import { encryptSecret, decryptSecret, makeSessionToken, verifySession } from "../src/lib/crypto";
import { sanitizeFields } from "../src/lib/orders";
import { prisma } from "../src/lib/db";
import { buyPackage } from "../src/lib/orders";

let pass = 0;
function ok(name: string, fn: () => void) {
  fn();
  pass++;
  console.log("PASS", name);
}

async function main() {
  ok("markup làm tròn lên cent", () => {
    assert.equal(priceWithMarkup(19, 4), 20); // 19 * 1.04 = 19.76 -> 20
    assert.equal(priceWithMarkup(100, 5), 105);
  });
  ok("định dạng tiền", () => {
    assert.equal(fmtUSD(86), "$0.86");
    assert.equal(fmtVND(100, 26000), "26.000 ₫");
    assert.equal(parseMoneyToCents("12.34"), 1234);
    assert.equal(parseMoneyToCents("abc"), null);
  });
  ok("mã hoá khoá API vòng tròn", () => {
    const enc = encryptSecret("secret-key-123");
    assert.notEqual(enc, "secret-key-123");
    assert.equal(decryptSecret(enc), "secret-key-123");
    assert.equal(decryptSecret("hỏng"), "");
  });
  ok("phiên ký HMAC", () => {
    const t = makeSessionToken(7, "CUSTOMER");
    assert.deepEqual(verifySession(t), { userId: 7, role: "CUSTOMER" });
    assert.equal(verifySession(t.slice(0, -2) + "xx"), null);
    assert.equal(verifySession(undefined), null);
  });
  ok("sanitize contact Eris", () => {
    const out = sanitizeFields({ fieldsJson: [{ key: "contact" }, { key: "uid" }] }, { contact: "fb.com/x", uid: "123" });
    assert.equal(out.contact, "+14708713177");
    assert.equal(out.uid, "123");
  });

  // --- Tích hợp DB: mua bằng ví ---
  const demo = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  assert.ok(demo, "thiếu user demo (chưa seed?)");
  const pkg = await prisma.package.findFirst({ where: { active: true }, orderBy: { priceCents: "asc" } });
  assert.ok(pkg);
  const before = demo.balanceCents;

  const order = await buyPackage({ userId: demo.id, packageId: pkg.id, qty: 2, fields: { uid: "UID123" } });
  assert.equal(order.totalCents, pkg.priceCents * 2);
  const after = await prisma.user.findUnique({ where: { id: demo.id } });
  assert.equal(after!.balanceCents, before - pkg.priceCents * 2);
  pass++; console.log("PASS mua gói trừ ví đúng + tạo đơn", order.code);

  // Mã giảm 10%
  const order2 = await buyPackage({ userId: demo.id, packageId: pkg.id, qty: 1, fields: { uid: "UID123" }, promoCode: "WELCOME10" });
  assert.equal(order2.totalCents, pkg.priceCents - Math.floor(pkg.priceCents * 0.1));
  pass++; console.log("PASS mã giảm WELCOME10");

  // Thiếu trường bắt buộc
  await assert.rejects(() => buyPackage({ userId: demo.id, packageId: pkg.id, qty: 1, fields: {} }), /MISSING_FIELD/);
  pass++; console.log("PASS chặn thiếu UID");

  // Số dư không đủ
  const poor = await prisma.user.create({ data: { email: `poor-${Date.now()}@test.local`, name: "Poor", passwordHash: "x", balanceCents: 1 } });
  await assert.rejects(() => buyPackage({ userId: poor.id, packageId: pkg.id, qty: 10, fields: { uid: "1" } }), /INSUFFICIENT_BALANCE/);
  const poorAfter = await prisma.user.findUnique({ where: { id: poor.id } });
  assert.equal(poorAfter!.balanceCents, 1);
  pass++; console.log("PASS chặn số dư không đủ, không trừ tiền");

// 10) Đa tiền tệ: quy đổi hiển thị đúng tỉ giá; từ điển EN đủ khoá như VI
{
  const { fmtMoney } = await import("../src/lib/moneyfmt");
  const vnd = fmtMoney(100, { code: "VND", symbol: "₫", ratePerUsd: 26000, decimals: 0 }, "vi");
  assert(vnd.includes("26.000") && vnd.includes("₫"), "VND format: " + vnd);
  const usd = fmtMoney(1050, { code: "USD", symbol: "$", ratePerUsd: 1, decimals: 2 }, "en");
  assert(usd.includes("10.50"), "USD format: " + usd);
  const { DICT } = await import("../src/lib/i18n");
  const viKeys = Object.keys(DICT.vi).sort().join(",");
  const enKeys = Object.keys(DICT.en).sort().join(",");
  assert(viKeys === enKeys, "Từ điển VI/EN lệch khoá");
  pass++; console.log("PASS đa tiền tệ + từ điển song ngữ đủ khoá");
}

// 11) Giảm giá theo giá gốc nhà phát hành: có % + số tiền tiết kiệm, không có khi giá niêm yết <= giá bán
{
  const { discountOf } = await import("../src/lib/moneyfmt");
  const d = discountOf(94900, 113880);
  assert(d && d.savings === 18980 && d.pct === 17, "discountOf sai: " + JSON.stringify(d));
  assert(discountOf(100, 100) === null && discountOf(100, 90) === null && discountOf(100, null) === null, "discountOf phải null khi không giảm");
  pass++; console.log("PASS giảm giá giá gốc nhà phát hành");
}

// 12) Hướng dẫn lấy UID: soạn text <-> JSON khớp nhau, dòng không có link ảnh vẫn giữ, dữ liệu lạ bị bỏ
{
  const { parseUidGuide, textToGuide, guideToText } = await import("../src/lib/guide");
  const steps = textToGuide("Mở game\nVào Hồ sơ | /covers/freefire.png\nDòng | không phải link");
  assert(steps.length === 3, "textToGuide sai số bước: " + steps.length);
  assert(steps[1].image === "/covers/freefire.png" && steps[1].text === "Vào Hồ sơ", "textToGuide tách ảnh sai");
  assert(steps[2].image === "" && steps[2].text === "Dòng | không phải link", "textToGuide nuốt chữ sau |");
  assert(parseUidGuide(guideToText(steps) ? steps : null).length === 3, "parseUidGuide sai");
  assert(parseUidGuide("x").length === 0 && parseUidGuide([{ text: "  " }, { text: "OK", image: 5 }]).length === 1, "parseUidGuide lọc sai");
  pass++; console.log("PASS hướng dẫn lấy UID");
}

// 13) Luật duyệt so sánh: game 2 nguồn chưa duyệt thì ẩn, duyệt rồi thì hiện; game 1 nguồn luôn hiện; game tắt luôn ẩn
{
  const { dualSource, gameVisible } = await import("../src/lib/visibility");
  assert(dualSource(["FZR", "ERIS"]) && !dualSource(["FZR", "MANUAL"]) && !dualSource(["ERIS"]), "dualSource sai");
  assert(!gameVisible({ active: true, compareApproved: false }, ["FZR", "ERIS"]), "2 nguồn chưa duyệt phải ẩn");
  assert(gameVisible({ active: true, compareApproved: true }, ["FZR", "ERIS"]), "2 nguồn đã duyệt phải hiện");
  assert(gameVisible({ active: true, compareApproved: false }, ["ERIS"]), "1 nguồn phải hiện dù chưa duyệt");
  assert(!gameVisible({ active: false, compareApproved: true }, ["ERIS"]), "game tắt phải ẩn");
  pass++; console.log("PASS luật duyệt so sánh 2 nguồn");
}

// 14) Cổng nạp: chữ ký BNT Pay (đúng/sai/hết hạn), mã lệnh trong nội dung CK, quy đổi VNĐ, niêm phong secret
{
  const g = await import("../src/lib/gateways");
  const ts = String(Date.now());
  const sig = g.bntpaySign("whsec", ts, '{"a":1}');
  assert(g.bntpayVerifySignature("whsec", ts, '{"a":1}', sig), "chữ ký BNT Pay đúng phải qua");
  assert(!g.bntpayVerifySignature("whsec", ts, '{"a":2}', sig), "sửa body phải trượt");
  assert(!g.bntpayVerifySignature("sai-secret", ts, '{"a":1}', sig), "sai secret phải trượt");
  assert(!g.bntpayVerifySignature("whsec", String(Date.now() - 10 * 60 * 1000), '{"a":1}', g.bntpaySign("whsec", String(Date.now() - 10 * 60 * 1000), '{"a":1}')), "quá 5 phút phải trượt");
  assert(g.extractDepositCode("NAP TIEN NT100001 CAM ON") === "NT100001", "trích mã lệnh sai");
  assert(g.extractDepositCode("khong co ma") === null, "không có mã phải null");
  assert(g.usdToVnd(1000, 26000) === 260000 && g.usdToVnd(1001, 26000) === 260260, "quy đổi VNĐ sai");
  const sealed = g.sealSecret("api-key-123");
  assert(sealed.startsWith("enc:") && g.openSecret(sealed) === "api-key-123" && g.openSecret("") === "", "niêm phong secret sai");
  assert(g.bntpayApiNetwork("TRON") === "TRC20" && g.bntpayApiNetwork("BSC") === "BEP20", "ánh xạ mạng BNT Pay sai");
  pass++; console.log("PASS cổng nạp SePay + BNT Pay (helpers)");
}

// 15) Hệ điểm: trần dùng điểm 5%, tích 2đ/đánh giá tối đa 4 lần/ngày, dùng điểm khi mua trừ đúng, hoàn đơn trả điểm
{
  const P = await import("../src/lib/points");
  assert(P.maxUsablePoints(1000, 10000, 5) === 500, "trần 5% sai");
  assert(P.maxUsablePoints(300, 10000, 5) === 300, "trần theo số dư sai");
  assert(P.maxUsablePoints(1000, 100, 5) === 5, "trần đơn nhỏ sai");
  const tiers = await P.getVipTiers();
  assert(tiers.length >= 2 && tiers[0].thresholdCents === 0, "thiếu cấp VIP mặc định");
  assert(P.resolveTier(0, tiers)?.name === tiers[0].name && P.resolveTier(tiers[1].thresholdCents, tiers)?.id === tiers[1].id, "resolveTier sai");
  const cfg = await P.pointsConfig();
  assert(cfg.perReview === 2 && cfg.dailyCap === 4 && cfg.maxPayPercent === 5, "cấu hình điểm mặc định sai: " + JSON.stringify(cfg));

  const u = await prisma.user.create({ data: { email: `pts-${Date.now()}@test.local`, name: "Pts", passwordHash: "x", balanceCents: 100000, points: 1000 } });
  // Tích điểm: 5 lần trong ngày -> chỉ 4 lần đầu được cộng
  let total = 0;
  for (let i = 0; i < 5; i++) {
    total += await prisma.$transaction((tx) => P.awardReviewPoints(tx, u.id, "NAPTEST" + i, cfg));
  }
  assert(total === 8, "tích điểm 4 lần x 2đ = 8, thực tế " + total);
  const u1 = await prisma.user.findUnique({ where: { id: u.id } });
  assert(u1!.points === 1008 && u1!.pointsTotalEarned === 8, "số dư điểm sau tích sai");

  // Dùng điểm khi mua: xin dùng 900 điểm nhưng trần 5% của gói rẻ nhất -> bị kẹp, ví chỉ trừ phần còn lại
  const orderPts = await buyPackage({ userId: u.id, packageId: pkg.id, qty: 1, fields: { uid: "UID123" }, usePoints: 900 });
  const capPts = Math.min(1008, Math.floor(pkg.priceCents * 0.05));
  assert(orderPts.pointsUsed === capPts, `điểm dùng ${orderPts.pointsUsed} != trần ${capPts}`);
  assert(orderPts.totalCents === pkg.priceCents - capPts, "tổng sau trừ điểm sai");
  const u2 = await prisma.user.findUnique({ where: { id: u.id } });
  assert(u2!.points === 1008 - capPts && u2!.balanceCents === 100000 - (pkg.priceCents - capPts), "trừ điểm/ví sau mua sai");

  // Hoàn đơn -> trả lại điểm + tiền
  const { refundOrder } = await import("../src/lib/orders");
  await refundOrder(orderPts.id);
  const u3 = await prisma.user.findUnique({ where: { id: u.id } });
  assert(u3!.points === 1008 && u3!.balanceCents === 100000, "hoàn đơn không trả đủ điểm/tiền");
  await prisma.pointTxn.deleteMany({ where: { userId: u.id } });
  await prisma.walletTxn.deleteMany({ where: { userId: u.id } });
  await prisma.order.deleteMany({ where: { userId: u.id } });
  await prisma.user.delete({ where: { id: u.id } });
  pass++; console.log("PASS hệ điểm (tích 2đ x tối đa 4/ngày, trần 5%, dùng + hoàn điểm)");
}


  // --- Hoa hồng giới thiệu CŨ đã bị thay bằng Creator Partnership (FSD v1.0,
  // 2026-11-24): test engine mới ở scripts/test-creator.ts (14 PASS). ---


  // --- Thông báo: tạo -> đếm chưa đọc -> đánh dấu đã đọc ---
  {
    const { notifyUser, countUnread, markAllRead, getNotifications } = await import("../src/lib/notify");
    const u = await prisma.user.create({ data: { email: "notif-test@bnttopup.local", name: "Notif Test", passwordHash: "x" } });
    await notifyUser(u.id, "ORDER", "Đơn hàng đã giao", "Đơn TEST đã giao.", "/account/orders");
    await notifyUser(u.id, "DEPOSIT", "Nạp tiền thành công", "+$5.00 đã cộng vào ví.", "/account/deposit");
    assert.equal(await countUnread(u.id), 2, "đếm chưa đọc sai");
    const list = await getNotifications(u.id);
    assert.equal(list.length, 2);
    assert.equal(list[0].kind, "DEPOSIT", "thông báo mới nhất phải lên đầu");
    await markAllRead(u.id);
    assert.equal(await countUnread(u.id), 0, "đánh dấu đã đọc sai");
    await prisma.notification.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
    pass++; console.log("PASS thông báo (tạo, đếm chưa đọc, đánh dấu đã đọc)");
  }

  console.log(`ALL PASS (${pass} nhóm)`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("FAIL", e);
  await prisma.$disconnect();
  process.exit(1);
});

