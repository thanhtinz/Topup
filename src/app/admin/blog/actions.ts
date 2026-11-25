"use server";
import { redirect } from "next/navigation";
import { unstable_rethrow } from "next/dist/client/components/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/settings";
import { sanitizePostHtml } from "@/lib/sanitize";

const back = (q: string): never => redirect("/admin/blog?" + q);
const ok = (m: string): never => back("msg=" + encodeURIComponent(m));
const err = (m: string): never => back("err=" + encodeURIComponent(m));

function slugify(input: string): string {
  return input
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 90) || "bai-viet";
}

export async function savePostAction(formData: FormData) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) err("Không có quyền");
  try {
    const id = Number(formData.get("id") ?? 0);
    const title = String(formData.get("title") ?? "").trim();
    if (title.length < 5) err("Tiêu đề quá ngắn");
    const contentHtml = sanitizePostHtml(String(formData.get("content") ?? ""));
    if (contentHtml.replace(/<[^>]+>/g, "").trim().length < 10) err("Nội dung bài quá ngắn");
    let slug = slugify(String(formData.get("slug") ?? "").trim() || title!);
    const clash = await prisma.post.findFirst({ where: { slug, id: id ? { not: id } : undefined }, select: { id: true } });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;
    const published = formData.get("published") === "1";
    const data = {
      title: title!,
      slug,
      excerpt: String(formData.get("excerpt") ?? "").trim().slice(0, 300),
      content: contentHtml,
      coverUrl: String(formData.get("coverUrl") ?? "").trim(),
      category: ["TIN_TUC", "HUONG_DAN", "SU_KIEN"].includes(String(formData.get("category"))) ? String(formData.get("category")) : "TIN_TUC",
      published,
    };
    if (id) {
      const old = await prisma.post.findUnique({ where: { id }, select: { publishedAt: true } });
      await prisma.post.update({ where: { id }, data: { ...data, publishedAt: published ? old?.publishedAt ?? new Date() : old?.publishedAt ?? null } });
      await audit(admin!.id, "blog.update", `#${id} ${title}`);
      ok("Đã lưu bài viết");
    } else {
      const post = await prisma.post.create({ data: { ...data, publishedAt: published ? new Date() : null } });
      await audit(admin!.id, "blog.create", `#${post.id} ${title}`);
      ok("Đã tạo bài viết");
    }
  } catch (e) {
    unstable_rethrow(e);
    err(e instanceof Error ? e.message : "Lưu không thành công");
  }
}

export async function togglePostAction(formData: FormData) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) err("Không có quyền");
  const id = Number(formData.get("id"));
  const published = String(formData.get("published")) === "1";
  const old = await prisma.post.findUnique({ where: { id }, select: { publishedAt: true } });
  await prisma.post.update({ where: { id }, data: { published, publishedAt: published ? old?.publishedAt ?? new Date() : old?.publishedAt } });
  await audit(admin!.id, "blog.toggle", `#${id} -> ${published ? "PUBLISHED" : "DRAFT"}`);
  ok(published ? "Đã xuất bản bài viết" : "Đã chuyển bài viết về bản nháp");
}

export async function deletePostAction(formData: FormData) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) err("Không có quyền");
  const id = Number(formData.get("id"));
  await prisma.post.delete({ where: { id } });
  await audit(admin!.id, "blog.delete", `#${id}`);
  ok("Đã xoá bài viết");
}
