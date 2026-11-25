import { prisma } from "../src/lib/db";
import { ensureCreatorLevels } from "../src/lib/creator";
async function main() {
  await ensureCreatorLevels();
  const gold = await prisma.creatorLevel.findFirst({ where: { name: "Gold" } });
  let u = await prisma.user.findUnique({ where: { email: "demo-creator@bnttopup.local" } });
  if (!u) u = await prisma.user.create({ data: { email: "demo-creator@bnttopup.local", name: "Alex Streamer", passwordHash: "x", balanceCents: 5000 } });
  let c = await prisma.creator.findUnique({ where: { userId: u.id } });
  if (!c) {
    c = await prisma.creator.create({ data: { userId: u.id, code: "ALEX123", displayName: "Alex Streamer", country: "Vietnam", language: "Tiếng Việt", tier: "VERIFIED", levelId: gold!.id, contactMethod: "Telegram", contactInfo: "@alexstream", agreementVersion: "1.0", agreementAt: new Date() } });
    await prisma.creatorLink.create({ data: { creatorId: c.id, code: c.code, name: "Link mặc định", destination: "/" } });
    await prisma.creatorLink.create({ data: { creatorId: c.id, code: "ALEX123-FF", name: "Link Free Fire", destination: "/game/free-fire" } });
    await prisma.creatorChannel.create({ data: { creatorId: c.id, platform: "YouTube", channelName: "Alex Gaming", url: "https://youtube.com/@alex", followers: 152000, avgViews: 48000, category: "FPS", audienceCountry: "Vietnam" } });
    await prisma.discountCode.create({ data: { code: "ALEX5", percent: 5, creatorId: c.id, maxDiscountCents: 2000 } });
    const buyer = await prisma.user.create({ data: { email: `demo-buyer-${Date.now()}@bnttopup.local`, name: "Buyer", passwordHash: "x" } });
    const game = await prisma.game.findFirst({ where: { slug: "free-fire" } }) ?? await prisma.game.findFirst();
    for (let i = 0; i < 6; i++) {
      const o = await prisma.order.create({ data: { code: `DEMO${i + 1}X${Date.now() % 100000}`, userId: buyer.id, gameId: game!.id, status: "DELIVERED", totalCents: 10000 + i * 2500, createdAt: new Date(Date.now() - i * 2 * 86400000) } });
      await prisma.creatorCommission.create({ data: { creatorId: c.id, orderId: o.id, orderCode: o.code, eligibleCents: o.totalCents, rateBps: 500, amountCents: Math.floor(o.totalCents * 0.05), status: i < 3 ? "AVAILABLE" : "PENDING", availableAt: new Date(Date.now() - 86400000) } });
    }
    for (let i = 0; i < 47; i++) await prisma.creatorClick.create({ data: { linkId: (await prisma.creatorLink.findFirst({ where: { creatorId: c.id } }))!.id, creatorId: c.id, visitorId: `v${i}`, createdAt: new Date(Date.now() - (i % 10) * 86400000) } });
    await prisma.creatorCampaign.create({ data: { name: "Black Friday Top-Up Festival", slug: "black-friday-demo", description: "Bonus hoa hồng cho mọi đơn trong tuần lễ Black Friday.", startAt: new Date(Date.now() - 86400000), endAt: new Date(Date.now() + 6 * 86400000), bonusBps: 200, status: "ACTIVE" } });
    await prisma.creatorMediaAsset.create({ data: { title: "Logo BNTGame (PNG)", fileUrl: "https://bntgame.com/favicon.ico", fileType: "FILE", category: "Logo" } });
  }
  console.log("seeded creator", c.code, "user", u.email);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
