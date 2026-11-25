import { prisma } from "../src/lib/db";
import { setSetting } from "../src/lib/settings";
import { sealSecret } from "../src/lib/gateways";
async function main() {
  await setSetting("google_login_enabled", "1");
  await setSetting("google_client_id", "demo.apps.googleusercontent.com");
  await setSetting("google_client_secret", sealSecret("demo-secret"));
  console.log("đã bật google test");
}
main().finally(() => prisma.$disconnect());
