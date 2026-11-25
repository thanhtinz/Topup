import { prisma } from "../src/lib/db";
import { encryptSecret } from "../src/lib/crypto";
import { syncProvider } from "../src/lib/providers";
import { buyPackage } from "../src/lib/orders";
import { applyBalance } from "../src/lib/wallet";

let fails = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) fails++;
}

async function main() {
  await prisma.provider.update({
    where: { code: "ERIS" },
    data: { enabled: true, baseUrl: "http://127.0.0.1:4560", apiKeyEnc: encryptSecret("test-key") },
  });
  const r = await syncProvider("ERIS", 26000);
  if ("error" in r) { console.log("SYNC ERROR", r.error); process.exit(1); }

  const games = await prisma.game.findMany({ where: { name: "Test Merge" } });
  check("gộp về đúng 1 game 'Test Merge'", games.length === 1, `thấy ${games.length}`);
  const g = games[0];
  const pkgs = await prisma.package.findMany({ where: { gameId: g.id }, orderBy: { id: "asc" } });
  check("có 2 gói", pkgs.length === 2, `thấy ${pkgs.length}`);
  const uidPkg = pkgs.find((p) => p.name === "100 Diamonds");
  const loginPkg = pkgs.find((p) => p.name === "Gói Login 30 ngày");
  check("gói UID: method=UID, region=VN", uidPkg?.method === "UID" && uidPkg?.region === "VN", `${uidPkg?.method}/${uidPkg?.region}`);
  check("gói Login: method=Login, region=Global", loginPkg?.method === "Login" && loginPkg?.region === "Global", `${loginPkg?.method}/${loginPkg?.region}`);
  const mf = (g.methodFieldsJson as Record<string, Array<{ key: string }>>) ?? {};
  check("methodFieldsJson có UID [uid,server]", (mf.UID ?? []).map((f) => f.key).join(",") === "uid,server", JSON.stringify(Object.keys(mf)));
  check("methodFieldsJson có Login [account,password,contact]", (mf.Login ?? []).map((f) => f.key).join(",") === "account,password,contact");
  check("game.regions gồm VN + Global", [...g.regions].sort().join(",") === "Global,VN", g.regions.join(","));

  const demo = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!demo || !loginPkg || !uidPkg) { console.log("thiếu demo/gói"); process.exit(1); }
  await prisma.$transaction((tx) => applyBalance(tx, demo.id, 100000, "TEST", "test-merge"));

  let missingBlocked = false;
  try {
    await buyPackage({ userId: demo.id, packageId: loginPkg.id, qty: 1, fields: { account: "acc1", contact: "https://m.me/x" } });
  } catch (e) { missingBlocked = String((e as Error).message).startsWith("MISSING_FIELD"); }
  check("thiếu mật khẩu (trường của Login) bị chặn", missingBlocked);

  const o1 = await buyPackage({ userId: demo.id, packageId: loginPkg.id, qty: 1, fields: { account: "acc1", password: "pw1", contact: "https://m.me/khach" } });
  const o1db = await prisma.order.findUnique({ where: { id: o1.id } });
  check("đơn Login DELIVERED", o1db?.status === "DELIVERED", `status=${o1db?.status}`);
  const o2 = await buyPackage({ userId: demo.id, packageId: uidPkg.id, qty: 1, fields: { uid: "556677", server: "Asia" } });
  const o2db = await prisma.order.findUnique({ where: { id: o2.id } });
  check("đơn UID DELIVERED", o2db?.status === "DELIVERED", `status=${o2db?.status}`);

  const purchases = (await (await fetch("http://127.0.0.1:4560/__purchases")).json()) as Array<{ categoryId: string; data: Record<string, string> }>;
  const loginPurchase = purchases.find((p) => p.categoryId === "502");
  check("payload Eris: contact bị thay bằng +14708713177", loginPurchase?.data.contact === "+14708713177", JSON.stringify(loginPurchase?.data));
  check("payload Eris: account giữ nguyên", loginPurchase?.data.account === "acc1");
  const uidPurchase = purchases.find((p) => p.categoryId === "501");
  check("payload Eris UID: uid giữ nguyên, không có contact", uidPurchase?.data.uid === "556677" && !("contact" in (uidPurchase?.data ?? {})));

  const item = await prisma.orderItem.findFirst({ where: { orderId: o1.id } });
  const savedFields = (item?.fieldsJson as Record<string, string>) ?? {};
  check("đơn lưu giữ link Messenger của khách", savedFields.contact === "https://m.me/khach", savedFields.contact);

  console.log(fails === 0 ? "ALL PASS" : `${fails} FAIL`);
  await prisma.$disconnect();
  process.exit(fails ? 1 : 0);
}
main();
