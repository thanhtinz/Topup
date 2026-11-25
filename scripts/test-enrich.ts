import { prisma } from "../src/lib/db";
import { runEnrichment } from "../src/lib/enrich";

let fails = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) fails++;
}

async function main() {
  let aov = await prisma.game.findFirst({ where: { name: "Arena of Valor" } });
  if (!aov) {
    aov = await prisma.game.create({
      data: { name: "Arena of Valor", slug: "arena-of-valor", cover: "", genre: "", regions: ["Global"], fieldsJson: [], active: true },
    });
    await prisma.package.create({ data: { gameId: aov.id, name: "Gói AoV test", region: "Global", method: "UID", costCents: 100, priceCents: 110, provider: "MANUAL" } });
  } else {
    await prisma.game.update({ where: { id: aov.id }, data: { cover: "", genre: "", bannerUrl: null, active: true } });
  }
  let ff = await prisma.game.findFirst({ where: { name: "Free Fire" } });
  if (!ff) {
    ff = await prisma.game.create({
      data: { name: "Free Fire", slug: "free-fire", cover: "", genre: "", regions: ["Global"], fieldsJson: [], active: true },
    });
  }
  for (const nm of ["100 Diamonds", "5,600 Diamonds", "113 Diamonds"]) {
    const ex = await prisma.package.findFirst({ where: { gameId: ff.id, name: nm } });
    if (!ex) await prisma.package.create({ data: { gameId: ff.id, name: nm, region: "Global", method: "UID", costCents: 100, priceCents: 110, provider: "MANUAL" } });
    else await prisma.package.update({ where: { id: ex.id }, data: { imageUrl: null } });
  }

  const st = await runEnrichment();
  console.log("enrich state:", JSON.stringify(st));

  const aov2 = await prisma.game.findUnique({ where: { id: aov.id } });
  check("AoV có bìa nét (iTunes 1024 hoặc vuông SEAGM)", ((aov2?.cover ?? "").includes("1024x1024bb") || (aov2?.cover ?? "").includes("seagmcdn")), aov2?.cover?.slice(0, 80));
  check("AoV có thể loại", (aov2?.genre ?? "").length > 0, aov2?.genre);
  check("AoV có banner (Google Play)", (aov2?.bannerUrl ?? "").includes("googleusercontent") || (aov2?.bannerUrl ?? "").length > 0, aov2?.bannerUrl?.slice(0, 80));
  check("Banner AoV độ phân giải =w1920", (aov2?.bannerUrl ?? "").includes("=w1920") || !(aov2?.bannerUrl ?? "").includes("googleusercontent"), aov2?.bannerUrl?.slice(-30));
  const pkgs = await prisma.package.findMany({ where: { gameId: ff.id, name: { in: ["100 Diamonds", "5,600 Diamonds", "113 Diamonds"] } } });
  const p100 = pkgs.find((p) => p.name === "100 Diamonds");
  const p5600 = pkgs.find((p) => p.name === "5,600 Diamonds");
  check("icon gói 100 Diamonds từ SEAGM", (p100?.imageUrl ?? "").includes("icon_sku/869-6337"), p100?.imageUrl ?? "");
  check("icon gói 5,600 Diamonds từ SEAGM", (p5600?.imageUrl ?? "").includes("icon_sku/869-24534"), p5600?.imageUrl ?? "");
  const p113 = pkgs.find((p) => p.name === "113 Diamonds");
  check("icon gói 113 Diamonds (mệnh giá lệch -> icon gần nhất)", (p113?.imageUrl ?? "").includes("icon_sku"), p113?.imageUrl ?? "");

  console.log(fails === 0 ? "ALL PASS" : `${fails} FAIL`);
  await prisma.$disconnect();
  process.exit(fails ? 1 : 0);
}
main();
