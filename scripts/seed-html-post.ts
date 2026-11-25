import { prisma } from "../src/lib/db";
import { sanitizePostHtml } from "../src/lib/sanitize";
async function main() {
  const dirty = `<h2>Tiêu đề phụ</h2><p>Đoạn <strong>đậm</strong> và <em>nghiêng</em> với <a href="https://bntgame.com/games">link</a>.</p><ul><li>Mục một</li><li>Mục hai</li></ul><script>alert(1)</script><p onclick="x()">Đoạn cuối</p>`;
  const clean = sanitizePostHtml(dirty);
  console.log("SANITIZED:", clean);
  await prisma.post.upsert({
    where: { slug: "bai-test-editor" },
    create: { title: "Bài test trình soạn thảo", slug: "bai-test-editor", excerpt: "Test rich text", content: clean, category: "TIN_TUC", published: true, publishedAt: new Date() },
    update: { content: clean, published: true },
  });
  console.log("seeded");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
