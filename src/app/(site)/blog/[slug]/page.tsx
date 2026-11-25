import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { isHtmlContent, sanitizePostHtml } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const CAT: Record<string, string> = { TIN_TUC: "Tin tức", HUONG_DAN: "Hướng dẫn", SU_KIEN: "Sự kiện" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.post.findUnique({ where: { slug }, select: { title: true, excerpt: true, published: true } });
  if (!post || !post.published) return { title: "Bài viết — BNTGame" };
  return { title: `${post.title} — BNTGame`, description: post.excerpt };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await prisma.post.findUnique({ where: { slug } });
  if (!post || !post.published) notFound();
  const htmlBody = isHtmlContent(post.content) ? sanitizePostHtml(post.content) : null;
  const paragraphs = htmlBody ? [] : post.content.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const others = await prisma.post.findMany({
    where: { published: true, slug: { not: slug } },
    orderBy: { publishedAt: "desc" },
    take: 3,
    select: { slug: true, title: true, category: true },
  });
  return (
    <main className="bsx">
      <div className="container" style={{ maxWidth: 760, paddingTop: 28, paddingBottom: 52 }}>
        <p style={{ marginBottom: 12 }}><Link href="/blog" style={{ fontWeight: 600 }}>← Tất cả bài viết</Link></p>
        <span className="crt-badge blue">{CAT[post.category] ?? "Tin tức"}</span>
        <h1 style={{ fontSize: 28, lineHeight: 1.3, margin: "10px 0 8px" }}>{post.title}</h1>
        {post.publishedAt && <p className="muted" style={{ marginBottom: 16 }}>{post.publishedAt.toLocaleDateString("vi-VN")}</p>}
        {post.coverUrl ? <img src={post.coverUrl} alt="" style={{ width: "100%", borderRadius: 16, marginBottom: 20 }} referrerPolicy="no-referrer" /> : null}
        {htmlBody ? (
          <div className="post-body" dangerouslySetInnerHTML={{ __html: htmlBody }} />
        ) : (
          <div style={{ fontSize: 16, lineHeight: 1.75, color: "var(--ink)" }}>
            {paragraphs.map((para, i) => (
              <p key={i} style={{ marginBottom: 16 }}>{para}</p>
            ))}
          </div>
        )}
        {others.length > 0 && (
          <div style={{ marginTop: 30, borderTop: "1px solid #E6EDF6", paddingTop: 18 }}>
            <h3 style={{ marginBottom: 10 }}>Bài viết khác</h3>
            {others.map((o) => (
              <p key={o.slug} style={{ marginBottom: 6 }}>
                <Link href={`/blog/${o.slug}`} style={{ fontWeight: 600 }}>{o.title}</Link>
                <span className="muted"> · {CAT[o.category] ?? "Tin tức"}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
