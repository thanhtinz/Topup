import { prisma } from "../src/lib/db";
import { setSetting } from "../src/lib/settings";
async function main() {
  await setSetting("google_login_enabled", "0");
  await setSetting("google_client_id", "");
  await setSetting("google_client_secret", "");
  console.log("đã dọn google test");
}
main().finally(() => prisma.$disconnect());
