import { prisma } from "../src/lib/db";
import { reconcilePackageImages } from "../src/lib/pkg-images";

async function main() {
  const before = await prisma.package.count({ where: { active: true, imageUrl: { not: null } } });
  const total = await prisma.package.count({ where: { active: true } });
  const { filled, games } = await reconcilePackageImages();
  const after = await prisma.package.count({ where: { active: true, imageUrl: { not: null } } });
  console.log(`packages with image: ${before} -> ${after} / ${total} (filled ${filled} across ${games} games)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
