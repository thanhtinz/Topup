import { prisma } from "../src/lib/db";
async function main() {
  const a = await prisma.creatorApplication.create({ data: { userId: 2, email: "mig@test.local", fullName: "Mig Test", country: "VN", contactMethod: "Telegram", contactInfo: "@mig", channelsJson: [{ platform: "YouTube", url: "https://yt/mig", followers: 1200, channelName: "MigChan", avgViews: 300 }] as never, contentTypes: "Review game", games: "Free Fire", experience: "2 năm làm review" } });
  console.log("created app", a.id);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
