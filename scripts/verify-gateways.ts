import "../tests/env";
import { prisma } from "../src/lib/db";
import { setSetting } from "../src/lib/settings";
import { sealSecret, bntpaySign } from "../src/lib/gateways";

const BASE = "http://127.0.0.1:3107";
const SEPAY_KEY = "test-sepay-key-123";

async function main() {
  const mode = process.argv[2] || "setup";
  if (mode === "cleanup") {
    await prisma.depositRequest.deleteMany({ where: { code: { in: ["NT900001", "NT900002"] } } });
    await prisma.webhookReceipt.deleteMany({ where: { ref: { startsWith: "sepay:TEST" } } });
    await prisma.webhookReceipt.deleteMany({ where: { ref: { startsWith: "bntpay:evt_test" } } });
    for (const k of ["pay_sepay_enabled", "pay_bntpay_enabled", "sepay_bank_name", "sepay_bank_bin", "sepay_account_number", "sepay_account_name", "sepay_secret", "bntpay_api_key", "bntpay_webhook_secret"]) {
      await prisma.setting.delete({ where: { key: k } }).catch(() => {});
    }
    console.log("đã dọn cấu hình + lệnh test");
    await prisma.$disconnect();
    return;
  }

  const demo = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!demo) throw new Error("NO_DEMO");
  await setSetting("pay_sepay_enabled", "1");
  await setSetting("sepay_bank_name", "MB Bank");
  await setSetting("sepay_bank_bin", "MB");
  await setSetting("sepay_account_number", "0123456789");
  await setSetting("sepay_account_name", "BNT SHOP");
  await setSetting("sepay_secret", sealSecret(SEPAY_KEY));
  await setSetting("pay_bntpay_enabled", "1");
  await setSetting("bntpay_api_key", sealSecret("test-merchant-key"));
  await setSetting("bntpay_webhook_secret", sealSecret("test-webhook-secret"));
  await prisma.depositRequest.deleteMany({ where: { code: { in: ["NT900001", "NT900002"] } } });
  await prisma.depositRequest.create({ data: { code: "NT900001", userId: demo.id, amountCents: 1000, method: "SEPAY", vndAmount: 260000 } });
  await prisma.depositRequest.create({ data: { code: "NT900002", userId: demo.id, amountCents: 2000, method: "BNTPAY", providerData: JSON.stringify({ externalOrderId: "NT900002", network: "TRON", cryptoAmount: "20", paymentAddress: "TTestAddress123" }) } });
  const before = (await prisma.user.findUnique({ where: { id: demo.id } }))!.balanceCents;
  console.log("số dư demo TRƯỚC:", before);

  const post = async (path: string, headers: Record<string, string>, body: string) => {
    const r = await fetch(BASE + path, { method: "POST", headers, body });
    return { status: r.status, json: await r.json().catch(() => null) };
  };

  let r = await post("/api/webhooks/sepay", { authorization: "Apikey sai", "content-type": "application/json" }, JSON.stringify({ id: "TEST1", content: "NT900001", transferAmount: 260000, transferType: "in" }));
  console.log("SePay sai khoá:", r.status, "(mong đợi 401)");
  r = await post("/api/webhooks/sepay", { authorization: `Apikey ${SEPAY_KEY}`, "content-type": "application/json" }, JSON.stringify({ id: "TEST1", content: "KHACH CHUYEN NT900001 NOP", transferAmount: 260000, transferType: "in", gateway: "MBBank" }));
  console.log("SePay khớp lệnh:", r.status, JSON.stringify(r.json), "(mong đợi credited:true)");
  r = await post("/api/webhooks/sepay", { authorization: `Apikey ${SEPAY_KEY}`, "content-type": "application/json" }, JSON.stringify({ id: "TEST1", content: "NT900001", transferAmount: 260000, transferType: "in" }));
  console.log("SePay trùng txId:", r.status, JSON.stringify(r.json), "(mong đợi deposit not pending/duplicate)");
  const rawBad = JSON.stringify({ eventId: "evt_test_1", externalOrderId: "NT900002", status: "COMPLETED", paidAmount: 20 });
  r = await post("/api/webhooks/bntpay", { "x-bntpay-webhook-timestamp": String(Date.now()), "x-bntpay-webhook-signature": "deadbeef", "content-type": "application/json" }, rawBad);
  console.log("BNT Pay sai chữ ký:", r.status, "(mong đợi 401)");
  const ts = String(Date.now());
  const raw = JSON.stringify({ eventId: "evt_test_1", externalOrderId: "NT900002", status: "COMPLETED", paidAmount: 20 });
  r = await post("/api/webhooks/bntpay", { "x-bntpay-webhook-timestamp": ts, "x-bntpay-webhook-signature": bntpaySign("test-webhook-secret", ts, raw), "content-type": "application/json" }, raw);
  console.log("BNT Pay COMPLETED:", r.status, JSON.stringify(r.json), "(mong đợi processed:true credited)");
  const ts2 = String(Date.now());
  r = await post("/api/webhooks/bntpay", { "x-bntpay-webhook-timestamp": ts2, "x-bntpay-webhook-signature": bntpaySign("test-webhook-secret", ts2, raw), "content-type": "application/json" }, raw);
  console.log("BNT Pay trùng eventId:", r.status, JSON.stringify(r.json), "(mong đợi duplicate:true)");

  const after = (await prisma.user.findUnique({ where: { id: demo.id } }))!.balanceCents;
  console.log("số dư demo SAU:", after, "| tăng:", after - before, "(mong đợi 3000 = $10 SePay + $20 BNT Pay)");
  await prisma.$disconnect();
}
main();
