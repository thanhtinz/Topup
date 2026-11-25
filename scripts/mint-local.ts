import { prisma } from "../src/lib/db";
import { makeSessionToken } from "../src/lib/session";
(async () => {
  const email = process.argv[2] || "admin@bnttopup.local";
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) throw new Error("no user " + email);
  console.log(makeSessionToken(u.id, u.role));
  process.exit(0);
})();
