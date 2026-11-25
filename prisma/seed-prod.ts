import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const pass = process.env.ADMIN_PASSWORD || "";
  if (!email || pass.length < 10) throw new Error("Cần ADMIN_EMAIL và ADMIN_PASSWORD (>= 10 ký tự)");

  await prisma.user.upsert({
    where: { email },
    create: { email, name: "Quản trị viên", passwordHash: await bcrypt.hash(pass, 10), role: "ADMIN" },
    update: {},
  });

  const CURS = [
    { code: "USD", name: "Đô la Mỹ", symbol: "$", ratePerUsd: 1, decimals: 2, enabled: true, isDefault: true, sortOrder: 0 },
    { code: "VND", name: "Việt Nam Đồng", symbol: "₫", ratePerUsd: 26000, decimals: 0, enabled: true, isDefault: false, sortOrder: 1 },
    { code: "EUR", name: "Euro", symbol: "€", ratePerUsd: 0.92, decimals: 2, enabled: true, isDefault: false, sortOrder: 2 },
    { code: "THB", name: "Baht Thái", symbol: "฿", ratePerUsd: 35.6, decimals: 2, enabled: false, isDefault: false, sortOrder: 3 },
  ];
  for (const c of CURS) await prisma.currency.upsert({ where: { code: c.code }, create: c, update: {} });

  await prisma.provider.upsert({
    where: { code: "FZR" },
    create: { code: "FZR", name: "FZR.CARDS", baseUrl: "https://api.fzr.cards", markupPercent: 4, enabled: false },
    update: {},
  });
  await prisma.provider.upsert({
    where: { code: "ERIS" },
    create: { code: "ERIS", name: "Eris (naperis.com)", baseUrl: "https://naperis.com", markupPercent: 5, enabled: false },
    update: {},
  });


  const SETTINGS: Record<string, string> = {
    site_name: "BNT Game",
    site_url: "https://bntgame.com",
  };
  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  console.log("Seed production xong:", email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
