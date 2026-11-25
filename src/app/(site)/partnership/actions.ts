"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getActivePartnershipTypes } from "@/lib/partnership";
import { isMailConfigured, sendMail } from "@/lib/mailer";
import { audit } from "@/lib/settings";

function backErr(msg: string): never {
  redirect(`/partnership/apply?err=${encodeURIComponent(msg)}`);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function parseJsonArray(raw: FormDataEntryValue | null): unknown[] {
  try {
    const v = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function submitPartnershipApplicationAction(formData: FormData) {
  if (String(formData.get("website2") ?? "") !== "") backErr("Gửi hồ sơ thất bại. Vui lòng thử lại.");

  const consent = String(formData.get("consent") ?? "");
  if (consent !== "1") backErr("Bạn cần đồng ý với điều khoản xử lý dữ liệu để gửi hồ sơ.");

  const fullName = String(formData.get("fullName") ?? "").trim().slice(0, 160);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  const country = String(formData.get("country") ?? "").trim().slice(0, 80);
  const applicantType = String(formData.get("applicantType") ?? "INDIVIDUAL") === "ORGANIZATION" ? "ORGANIZATION" : "INDIVIDUAL";
  const proposalText = String(formData.get("proposalText") ?? "").trim().slice(0, 5000);
  const audienceText = String(formData.get("audienceText") ?? "").trim().slice(0, 1000);
  const budgetText = String(formData.get("budgetText") ?? "").trim().slice(0, 200);
  const contactMethod = String(formData.get("contactMethod") ?? "").trim().slice(0, 40);
  const contactInfo = String(formData.get("contactInfo") ?? "").trim().slice(0, 200);

  if (fullName.length < 2) backErr("Vui lòng nhập họ tên / tên tổ chức.");
  if (!EMAIL_RE.test(email)) backErr("Email chưa đúng định dạng.");
  if (!country) backErr("Vui lòng nhập quốc gia / khu vực.");
  if (proposalText.length < 30) backErr("Phần mô tả đề xuất hợp tác cần tối thiểu 30 ký tự để đội Partnership đánh giá.");

  const activeTypes = await getActivePartnershipTypes();
  const activeCodes = new Set(activeTypes.map((t) => t.code));
  const types = (parseJsonArray(formData.get("typesJson")) as unknown[])
    .map((x) => String(x).toUpperCase())
    .filter((c, i, arr) => activeCodes.has(c) && arr.indexOf(c) === i)
    .slice(0, 9);
  if (types.length === 0) backErr("Vui lòng chọn ít nhất một loại hình hợp tác.");

  const socialLinks = (parseJsonArray(formData.get("socialLinksJson")) as Array<Record<string, unknown>>)
    .slice(0, 8)
    .map((r) => ({
      platform: String(r.platform ?? "Website").slice(0, 40),
      url: String(r.url ?? "").trim().slice(0, 400),
      followers: Math.max(0, Math.min(100_000_000, Number(r.followers ?? 0) || 0)),
    }))
    .filter((r) => r.url !== "");

  let extra: Record<string, unknown> = {};
  try {
    const v = JSON.parse(String(formData.get("extraJson") ?? "{}"));
    if (v && typeof v === "object" && !Array.isArray(v)) extra = v as Record<string, unknown>;
  } catch { /* bỏ qua extra lỗi */ }
  const cleanExtra: Record<string, string> = {};
  for (const [k, v] of Object.entries(extra)) {
    if (typeof v === "string") cleanExtra[k.slice(0, 40)] = v.trim().slice(0, 500);
  }

  const recent = await prisma.partnerApplication.count({
    where: { email, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= 3) backErr("Bạn đã gửi nhiều hồ sơ trong thời gian ngắn. Vui lòng thử lại sau ít phút.");

  const user = await getCurrentUser().catch(() => null);
  const app = await prisma.partnerApplication.create({
    data: {
      applicantUserId: user?.id ?? null,
      applicantType,
      fullName,
      email,
      country,
      typesJson: types,
      socialLinksJson: socialLinks,
      audienceText,
      proposalText,
      budgetText,
      extraJson: cleanExtra,
      contactMethod,
      contactInfo,
      consentAt: new Date(),
      status: "SUBMITTED",
    },
  });
  await audit(user?.id ?? null, "partnership.application.submit", `#${app.id} ${email} [${types.join(",")}]`).catch(() => null);

  if (await isMailConfigured().catch(() => false)) {
    const typeNames = activeTypes.filter((t) => types.includes(t.code)).map((t) => t.name).join(", ");
    await sendMail(
      email,
      "BNTGame đã nhận hồ sơ hợp tác của bạn",
      `<p>Xin chào ${fullName},</p><p>BNTGame đã nhận hồ sơ hợp tác của bạn (mã hồ sơ <b>#${app.id}</b>) cho loại hình: ${typeNames}.</p><p>Đội Partnership sẽ xem xét và phản hồi qua email này. Bạn không cần gửi lại hồ sơ.</p><p>— Đội Partnership BNTGame</p>`,
    ).catch(() => false);
  }

  redirect(`/partnership/apply?sent=1&id=${app.id}`);
}
