import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type SeedGame = {
  name: string; slug: string; cover: string; genre: string;
  regions: string[]; fromCents: number; isNew?: boolean; sold?: number;
};

const GAMES: SeedGame[] = [
  { name: "Free Fire", slug: "free-fire", cover: "/covers/freefire.png", genre: "FPS · Bắn súng", regions: ["Việt Nam", "Thái Lan", "Indonesia", "Brazil", "Ấn Độ", "MENA", "Châu Âu", "Bắc Mỹ", "Nam Mỹ", "Đài Loan", "Pakistan", "Bangladesh"], fromCents: 6, sold: 15230 },
  { name: "Genshin Impact", slug: "genshin-impact", cover: "/covers/genshin.jpg", genre: "Gacha", regions: ["UID", "Login (Ưu đãi)"], fromCents: 83, sold: 9840 },
  { name: "8 Ball Pool", slug: "8-ball-pool", cover: "/covers/8ball.png", genre: "Chiến thuật", regions: ["Global"], fromCents: 77, sold: 3120 },
  { name: "Honkai: Star Rail", slug: "honkai-star-rail", cover: "/covers/hsr.jpg", genre: "Gacha", regions: ["Global"], fromCents: 89, sold: 7650 },
  { name: "Ace Racer", slug: "ace-racer", cover: "/covers/aceracer.jpg", genre: "Đua xe", regions: ["Global"], fromCents: 97, sold: 1980 },
  { name: "AFK Journey", slug: "afk-journey", cover: "/covers/afk.jpg", genre: "Nhập vai", regions: ["Global"], fromCents: 86, sold: 4210 },
  { name: "Acecraft", slug: "acecraft", cover: "/covers/acecraft.jpg", genre: "Gacha", regions: ["Global"], fromCents: 104, sold: 860 },
  { name: "Age of Empire Mobile", slug: "age-of-empire-mobile", cover: "/covers/aoe.jpg", genre: "Chiến thuật", regions: ["Global"], fromCents: 91, sold: 640 },
  { name: "Zenless Zone Zero", slug: "zenless-zone-zero", cover: "/covers/zzz.webp", genre: "Gacha", regions: ["Asia", "America", "Europe"], fromCents: 103, isNew: true, sold: 2210 },
  { name: "Wuthering Waves", slug: "wuthering-waves", cover: "/covers/wuwa.webp", genre: "Gacha", regions: ["Asia", "America"], fromCents: 90, isNew: true, sold: 1740 },
  { name: "Where Winds Meet PC", slug: "where-winds-meet-pc", cover: "/covers/wwm.webp", genre: "Nhập vai", regions: ["Global"], fromCents: 100, isNew: true, sold: 320 },
  { name: "Reverse: 1999", slug: "reverse-1999", cover: "/covers/reverse.jpg", genre: "Gacha", regions: ["Global"], fromCents: 100, isNew: true, sold: 410 },
  { name: "Blood Strike", slug: "blood-strike", cover: "/covers/bloodstrike.jpg", genre: "FPS · Bắn súng", regions: ["SEA", "Global"], fromCents: 42, isNew: true, sold: 2890 },
  { name: "Neverness to Everness", slug: "neverness-to-everness", cover: "/covers/neverness.webp", genre: "Gacha", regions: ["Asia", "Global"], fromCents: 75, isNew: true, sold: 150 },
];

const PKG_MULT = [1, 2.4, 5.5, 12, 26, 60];

async function main() {
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "admin12345";
  await prisma.user.upsert({
    where: { email: "admin@bnttopup.local" },
    create: { email: "admin@bnttopup.local", name: "Quản trị viên", passwordHash: await bcrypt.hash(adminPass, 10), role: "ADMIN" },
    update: {},
  });
  await prisma.user.upsert({
    where: { email: "demo@bnttopup.local" },
    create: { email: "demo@bnttopup.local", name: "Khách demo", passwordHash: await bcrypt.hash("demo12345", 10), role: "CUSTOMER", balanceCents: 5000 },
    update: {},
  });

  const CURS = [
    { code: "USD", name: "Đô la Mỹ", symbol: "$", ratePerUsd: 1, decimals: 2, enabled: true, isDefault: true, sortOrder: 0 },
    { code: "VND", name: "Việt Nam Đồng", symbol: "₫", ratePerUsd: 26000, decimals: 0, enabled: true, isDefault: false, sortOrder: 1 },
    { code: "EUR", name: "Euro", symbol: "€", ratePerUsd: 0.92, decimals: 2, enabled: true, isDefault: false, sortOrder: 2 },
    { code: "THB", name: "Baht Thái", symbol: "฿", ratePerUsd: 35.6, decimals: 2, enabled: false, isDefault: false, sortOrder: 3 },
  ];
  for (const c of CURS) await prisma.currency.upsert({ where: { code: c.code }, create: c, update: {} });

  const UID_GUIDES: Record<string, { text: string; image: string }[]> = {
    "free-fire": [
      { text: "Mở Free Fire và đăng nhập tài khoản của bạn.", image: "/covers/freefire.png" },
      { text: "Chạm vào avatar ở góc trên bên trái để mở trang Hồ sơ.", image: "/covers/freefire.png" },
      { text: "UID là dãy số nằm ngay dưới tên nhân vật — chép đúng dãy số đó vào ô UID khi đặt đơn.", image: "/covers/freefire.png" },
    ],
    "genshin-impact": [
      { text: "Mở Genshin Impact và vào game như bình thường.", image: "/covers/genshin.jpg" },
      { text: "UID nằm ở góc dưới bên phải màn hình, là dãy số bắt đầu bằng 8.", image: "/covers/genshin.jpg" },
      { text: "Chép đúng UID vào ô UID khi đặt đơn — kiểm tra kỹ vì nạp nhầm UID sẽ không hoàn lại được.", image: "/covers/genshin.jpg" },
    ],
  };
  for (const g of GAMES) {
    const game = await prisma.game.upsert({
      where: { slug: g.slug },
      create: {
        name: g.name, slug: g.slug, cover: g.cover, genre: g.genre, regions: g.regions,
        uidGuideJson: UID_GUIDES[g.slug] ?? [],
        isNew: !!g.isNew, soldCount: g.sold ?? 0,
        ratingAvg: Math.round((4.6 + ((g.sold ?? 0) % 40) / 100) * 10) / 10,
        ratingCount: Math.max(12, Math.round((g.sold ?? 0) / 9)),
        fieldsJson: [
          { key: "uid", label: "ID người chơi (UID)", required: true, placeholder: "Nhập UID trong game" },
          { key: "server", label: "Server / Máy chủ", required: false, placeholder: "Để trống nếu không có" },
          ...(g.regions.some((r) => r.includes("Login"))
            ? [{ key: "contact", label: "Link Messenger hoặc Telegram (cho gói Login)", required: false, placeholder: "Dán link liên hệ của bạn" }]
            : []),
        ],
      },
      update: {
        uidGuideJson: UID_GUIDES[g.slug] ?? [],
        soldCount: g.sold ?? 0,
        ratingAvg: Math.round((4.6 + ((g.sold ?? 0) % 40) / 100) * 10) / 10,
        ratingCount: Math.max(12, Math.round((g.sold ?? 0) / 9)),
        regions: g.regions,
        fieldsJson: [
          { key: "uid", label: "ID người chơi (UID)", required: true, placeholder: "Nhập UID trong game" },
          { key: "server", label: "Server / Máy chủ", required: false, placeholder: "Để trống nếu không có" },
          ...(g.regions.some((r) => r.includes("Login"))
            ? [{ key: "contact", label: "Link Messenger hoặc Telegram (cho gói Login)", required: false, placeholder: "Dán link liên hệ của bạn" }]
            : []),
        ],
      },
    });
    await prisma.package.deleteMany({ where: { gameId: game.id, provider: "MANUAL", orderItems: { none: {} } } });
    const isMethodGame = g.regions.some((r) => r === "UID" || r.includes("Login"));
    const regionList = isMethodGame ? ["Global"] : g.regions;
    const methodList = isMethodGame ? g.regions : ["UID"];
    for (const region of regionList) {
      const regionIdx = regionList.indexOf(region);
      for (const method of methodList) {
        for (let i = 0; i < PKG_MULT.length; i++) {
          const factor = (1 + regionIdx * 0.02) * (method.includes("Login") ? 0.95 : 1);
          const price = Math.max(1, Math.round(g.fromCents * PKG_MULT[i] * factor));
          await prisma.package.create({
            data: {
              gameId: game.id,
              name: `Gói nạp $${(price / 100).toFixed(2)}`,
              region,
              method,
              costCents: Math.max(1, Math.round(price * 0.95)),
              priceCents: price,
              listPriceCents: Math.round(price * 1.2),
              provider: "MANUAL",
            },
          });
        }
      }
    }
  }
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
  if ((await prisma.vipTier.count()) === 0) {
    await prisma.vipTier.createMany({
      data: [
        { name: "V0", thresholdCents: 0, discountPercent: 0, couponPercent: 0, lateComp: false, sort: 0 },
        { name: "V1", thresholdCents: 500, discountPercent: 1, couponPercent: 5, lateComp: false, sort: 1 },
        { name: "V2", thresholdCents: 5000, discountPercent: 2, couponPercent: 5, lateComp: true, sort: 2 },
        { name: "V3", thresholdCents: 20000, discountPercent: 3, couponPercent: 5, lateComp: true, sort: 3 },
        { name: "V4", thresholdCents: 50000, discountPercent: 5, couponPercent: 10, lateComp: true, sort: 4 },
      ],
    });
  }
  await prisma.discountCode.upsert({
    where: { code: "WELCOME10" },
    create: { code: "WELCOME10", percent: 10, active: true },
    update: {},
  });
  console.log("Seed xong: admin@bnttopup.local / demo@bnttopup.local, 14 game");
}

main().finally(() => prisma.$disconnect());
