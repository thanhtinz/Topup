import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const G: Record<string, { text: string; image: string }[]> = {
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
async function main() {
for (const [slug, steps] of Object.entries(G)) {
  const r = await prisma.game.updateMany({ where: { slug }, data: { uidGuideJson: steps } });
  console.log(slug, "->", r.count, "game,", steps.length, "bước");
}
const ff = await prisma.game.findUnique({ where: { slug: "free-fire" }, select: { uidGuideJson: true } });
console.log("FF guide trong DB:", JSON.stringify(ff?.uidGuideJson).slice(0, 80));
await prisma.$disconnect();

}
main();
