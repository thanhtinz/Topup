import { prisma } from "../src/lib/db";
import { issueEmailCode, verifyEmailCode, peekEmailCodePayload } from "../src/lib/emailcodes";

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log("PASS", name); }
  else { fail++; console.log("FAIL", name); }
}

(async () => {
  const email = `codetest-${Date.now()}@example.local`;
  await prisma.emailCode.deleteMany({ where: { email } });

  const i1 = await issueEmailCode(email, "REGISTER", JSON.stringify({ name: "Test" }));
  check("issue returns 6-digit code", "code" in i1 && /^\d{6}$/.test(i1.code));
  const code1 = "code" in i1 ? i1.code : "";

  const i2 = await issueEmailCode(email, "REGISTER");
  check("immediate re-issue blocked by cooldown", "cooldown" in i2);

  const wrong = code1 === "000000" ? "000001" : "000000";
  const vWrong = await verifyEmailCode(email, "REGISTER", wrong);
  check("wrong code rejected", !vWrong.ok && vWrong.reason === "INVALID");
  const vOk = await verifyEmailCode(email, "REGISTER", code1);
  check("correct code accepted with payload", vOk.ok && JSON.parse(vOk.payload).name === "Test");

  const vAgain = await verifyEmailCode(email, "REGISTER", code1);
  check("code is single-use", !vAgain.ok && vAgain.reason === "NONE");

  await prisma.emailCode.deleteMany({ where: { email } });
  await prisma.emailCode.updateMany({ where: { email }, data: { createdAt: new Date(0) } });
  const i3 = await issueEmailCode(email, "RESET");
  const code3 = "code" in i3 ? i3.code : "";
  let lastReason = "";
  for (let k = 0; k < 5; k++) {
    const v = await verifyEmailCode(email, "RESET", code3 === "999999" ? "999998" : "999999");
    if (!v.ok) lastReason = v.reason;
  }
  check("5 wrong attempts kill the code", lastReason === "TOO_MANY");
  const vAfter = await verifyEmailCode(email, "RESET", code3);
  check("correct code dead after too many attempts", !vAfter.ok);

  const i4 = await issueEmailCode(email, "RESET");
  const code4 = "code" in i4 ? i4.code : "";
  await prisma.emailCode.updateMany({ where: { email, purpose: "RESET" }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const vExp = await verifyEmailCode(email, "RESET", code4);
  check("expired code rejected", !vExp.ok && vExp.reason === "EXPIRED");

  await prisma.emailCode.deleteMany({ where: { email } });
  const i5 = await issueEmailCode(email, "REGISTER", JSON.stringify({ name: "Gửi lại" }));
  check("re-issue ok", "code" in i5);
  const payload = await peekEmailCodePayload(email, "REGISTER");
  check("payload preserved for resend", payload != null && JSON.parse(payload).name === "Gửi lại");

  await prisma.emailCode.deleteMany({ where: { email } });
  console.log(`\n== ${pass} PASS, ${fail} FAIL ==`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
