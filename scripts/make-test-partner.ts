import { prisma } from "../src/lib/db";
import { assertTestDb } from "./guard";
import { campaignCode } from "../src/lib/partnership";

async function main() {
  assertTestDb();
  const demo = await prisma.user.findUnique({ where: { email: "demo@bnttopup.local" } });
  if (!demo) throw new Error("demo user missing");

  await prisma.partner.deleteMany({ where: { email: { in: ["demo@bnttopup.local", "other@example.com"] } } });
  await prisma.partnerCampaign.deleteMany({ where: { name: { in: ["Chiến dịch Test Portal", "Chiến dịch Của Người Khác"] } } });

  const partner = await prisma.partner.create({
    data: {
      userId: demo.id,
      displayName: "Demo Creator",
      email: "demo@bnttopup.local",
      country: "VN",
      status: "ACTIVE",
      profile: { create: { bio: "Creator test", website: "https://youtube.com/@demo" } },
    },
  });
  const other = await prisma.partner.create({
    data: { displayName: "Other Partner", email: "other@example.com", status: "ACTIVE" },
  });

  const c1 = await prisma.partnerCampaign.create({
    data: { code: "TMP1", name: "Chiến dịch Test Portal", objective: "Mục tiêu test", brief: "Brief test", status: "ACTIVE", budgetCents: 100000 },
  });
  await prisma.partnerCampaign.update({ where: { id: c1.id }, data: { code: campaignCode(c1.id) } });
  const c2 = await prisma.partnerCampaign.create({
    data: { code: "TMP2", name: "Chiến dịch Được Mời", status: "SCHEDULED" },
  });
  await prisma.partnerCampaign.update({ where: { id: c2.id }, data: { code: campaignCode(c2.id) } });
  const cOther = await prisma.partnerCampaign.create({
    data: { code: "TMP3", name: "Chiến dịch Của Người Khác", status: "ACTIVE" },
  });
  await prisma.partnerCampaign.update({ where: { id: cOther.id }, data: { code: campaignCode(cOther.id) } });

  const joinAccepted = await prisma.campaignPartner.create({ data: { campaignId: c1.id, partnerId: partner.id, status: "ACCEPTED" } });
  await prisma.campaignPartner.create({ data: { campaignId: c2.id, partnerId: partner.id, status: "INVITED" } });
  await prisma.campaignPartner.create({ data: { campaignId: cOther.id, partnerId: other.id, status: "ACCEPTED" } });

  const d1 = await prisma.deliverable.create({
    data: { campaignPartnerId: joinAccepted.id, title: "Video review game", dueAt: new Date(Date.now() + 3 * 24 * 3600 * 1000), status: "PENDING" },
  });
  await prisma.deliverable.create({
    data: { campaignPartnerId: joinAccepted.id, title: "Bài đăng Facebook", status: "REVISION_REQUIRED", submittedUrl: "https://facebook.com/post/1", reviewNote: "Cần sửa caption" },
  });
  await prisma.agreement.create({
    data: { partnerId: partner.id, campaignId: c1.id, title: "Thỏa thuận chiến dịch test", feeCents: 50000, currency: "USD", status: "SENT" },
  });
  await prisma.partnerPayment.create({
    data: { partnerId: partner.id, campaignId: c1.id, deliverableId: d1.id, amountCents: 20000, currency: "USD", type: "FIXED_FEE", status: "PAID", paidAt: new Date(), method: "USDT", txRef: "TXTEST123" },
  });
  await prisma.partnerPayment.create({
    data: { partnerId: partner.id, amountCents: 30000, currency: "USD", type: "MILESTONE", status: "APPROVED" },
  });

  console.log(JSON.stringify({ partnerId: partner.id, campaignId: c1.id, inviteCampaignId: c2.id, otherCampaignId: cOther.id, deliverableId: d1.id }));
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
