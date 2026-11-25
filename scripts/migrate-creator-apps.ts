import { prisma } from "../src/lib/db";

const STATUS_MAP: Record<string, string> = { PENDING: "SUBMITTED", UNDER_REVIEW: "UNDER_REVIEW" };

async function main() {
  const apps = await prisma.creatorApplication.findMany({
    where: { status: { in: ["PENDING", "UNDER_REVIEW"] } },
    orderBy: { id: "asc" },
  });
  console.log(`Đơn Creator còn mở: ${apps.length}`);
  let moved = 0, skipped = 0;
  for (const a of apps) {
    const marker = `[Đơn Creator #${a.id}]`;
    const exists = await prisma.partnerApplication.findFirst({ where: { reviewNote: { startsWith: marker } } });
    if (exists) { skipped++; continue; }
    const channels = Array.isArray(a.channelsJson) ? (a.channelsJson as Array<Record<string, unknown>>) : [];
    const audience = [
      a.contentTypes && `Loại nội dung: ${a.contentTypes}`,
      a.games && `Game: ${a.games}`,
      a.streamFreq && `Tần suất stream: ${a.streamFreq}`,
      a.videoFreq && `Tần suất video: ${a.videoFreq}`,
    ].filter(Boolean).join("\n");
    await prisma.partnerApplication.create({
      data: {
        applicantUserId: a.userId ?? null,
        fullName: a.fullName,
        email: a.email,
        country: a.country,
        typesJson: ["AFFILIATE"],
        socialLinksJson: channels.map((c) => ({
          platform: String(c.platform ?? ""),
          url: String(c.url ?? ""),
          followers: Number(c.followers ?? 0),
          channelName: String(c.channelName ?? ""),
          avgViews: Number(c.avgViews ?? 0),
        })) as never,
        audienceText: audience,
        proposalText: a.experience,
        contactMethod: a.contactMethod,
        contactInfo: a.contactInfo,
        extraJson: { fromCreatorApplication: a.id, language: a.language, partnershipJson: a.partnershipJson ?? [] } as never,
        status: STATUS_MAP[a.status] ?? "SUBMITTED",
        reviewNote: `${marker} ${a.reviewNote ?? ""}`.trim(),
        reviewedById: a.reviewedById ?? null,
        reviewedAt: a.reviewedAt ?? null,
        createdAt: a.createdAt,
      },
    });
    await prisma.creatorApplication.update({
      where: { id: a.id },
      data: { status: "MIGRATED", reviewNote: `${(a.reviewNote ?? "").trim()} [Đã chuyển sang đơn Partnership loại Affiliate]`.trim() },
    });
    moved++;
    console.log(`  #${a.id} ${a.email} -> PartnerApplication (AFFILIATE, ${STATUS_MAP[a.status]})`);
  }
  console.log(`Xong: chuyển ${moved}, bỏ qua (đã chuyển) ${skipped}.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
