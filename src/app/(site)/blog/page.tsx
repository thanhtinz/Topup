import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tin tức & Hướng dẫn — BNTGame", description: "Tin tức game, hướng dẫn nạp game và sự kiện khuyến mãi từ BNTGame." };

const CAT: Record<string, string> = { TIN_TUC: "Tin tức", HUONG_DAN: "Hướng dẫn", SU_KIEN: "Sự kiện" };

export default async function BlogPage() {
  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    take: 30,
    select: { slug: true, title: true, excerpt: true, coverUrl: true, category: true, publishedAt: true },
  });
  return (
    <main className="bsx">
      <div className="container" style={{ maxWidth: 1000, paddingTop: 28, paddingBottom: 52 }}>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>Tin tức & Hướng dẫn</h1>
        <p className="muted" style={{ marginBottom: 20 }}>Tin game mới, hướng dẫn nạp an toàn và các sự kiện khuyến mãi của BNTGame.</p>
        {posts.length === 0 ? (
          <div className="crt-card" style={{ textAlign: "center", padding: "30px 20px" }}>
            <p className="muted">Chưa có bài viết nào — quay lại sau nhé!</p>
          </div>
        ) : (
          <div className="blog-grid">
            {posts.map((p) => (
              <Link key={p.slug} className="blog-card" href={`/blog/${p.slug}`}>
                {p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : null}
                <div className="blog-body">
                  <span className="crt-badge blue" style={{ marginBottom: 8 }}>{CAT[p.category] ?? "Tin tức"}</span>
                  <h3>{p.title}</h3>
                  <p>{p.excerpt}</p>
                  {p.publishedAt && <p style={{ marginTop: 8, fontSize: 12.5 }}>{p.publishedAt.toLocaleDateString("vi-VN")}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
