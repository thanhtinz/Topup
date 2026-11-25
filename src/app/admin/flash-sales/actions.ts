"use server";
import { redirect } from "next/navigation";
import { unstable_rethrow } from "next/dist/client/components/navigation";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { audit } from "@/lib/settings";

const back = (q: string): never => redirect("/admin/flash-sales?" + q);
const ok = (m: string): never => back("msg=" + encodeURIComponent(m));
const err = (m: string): never => back("err=" + encodeURIComponent(m));

export async function createSaleAction(formData: FormData) {
  const admin = await requireOwner().catch(() => null);
  if (!admin) err("Không có quyền");
  try {
    const name = String(formData.get("name") ?? "").trim();
    const startsAt = new Date(String(formData.get("startsAt") ?? ""));
    const endsAt = new Date(String(formData.get("endsAt") ?? ""));
    if (name.length < 2) err("Tên đợt Flash Sale quá ngắn");
    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime()) || endsAt <= startsAt) err("Khung giờ không hợp lệ (giờ kết thúc phải sau giờ bắt đầu)");
    const sale = await prisma.flashSale.create({ data: { name, startsAt, endsAt, active: formData.get("active") === "1" } });
    await audit(admin!.id, "flashsale.create", `#${sale.id} ${name}`);
    ok("Đã tạo đợt Flash Sale — thêm gói vào đợt ở mục bên dưới");
  } catch (e) {
    unstable_rethrow(e);
    err(e instanceof Error ? e.message : "Tạo không thành công");
  }
}

export async function toggleSaleAction(formData: FormData) {
  const admin = await requireOwner().catch(() => null);
  if (!admin) err("Không có quyền");
  const id = Number(formData.get("id"));
  const active = String(formData.get("active")) === "1";
  await prisma.flashSale.update({ where: { id }, data: { active } });
  await audit(admin!.id, "flashsale.toggle", `#${id} -> ${active ? "ON" : "OFF"}`);
  ok(active ? "Đã bật đợt Flash Sale" : "Đã tắt đợt Flash Sale");
}

export async function deleteSaleAction(formData: FormData) {
  const admin = await requireOwner().catch(() => null);
  if (!admin) err("Không có quyền");
  const id = Number(formData.get("id"));
  await prisma.flashSale.delete({ where: { id } });
  await audit(admin!.id, "flashsale.delete", `#${id}`);
  ok("Đã xoá đợt Flash Sale");
}

export async function addItemAction(formData: FormData) {
  const admin = await requireOwner().catch(() => null);
  if (!admin) err("Không có quyền");
  try {
    const flashSaleId = Number(formData.get("flashSaleId"));
    const packageId = Number(formData.get("packageId"));
    const salePriceCents = Math.round(Number(formData.get("salePrice")) * 100);
    const stockRaw = String(formData.get("stockLimit") ?? "").trim();
    const stockLimit = stockRaw === "" ? null : Math.max(1, Math.floor(Number(stockRaw)));
    const pkg = await prisma.package.findUnique({ where: { id: packageId }, select: { priceCents: true, name: true } });
    if (!pkg) err("Không tìm thấy gói");
    if (!(salePriceCents > 0) || salePriceCents >= pkg!.priceCents) err("Giá flash phải nhỏ hơn giá thường của gói");
    await prisma.flashSaleItem.create({ data: { flashSaleId, packageId, salePriceCents, stockLimit } });
    await audit(admin!.id, "flashsale.item_add", `sale#${flashSaleId} pkg#${packageId} ${salePriceCents}`);
    ok(`Đã thêm gói ${pkg!.name} vào Flash Sale`);
  } catch (e) {
    unstable_rethrow(e);
    err(e instanceof Error && e.message.includes("Unique constraint") ? "Gói này đã có trong đợt sale" : e instanceof Error ? e.message : "Thêm không thành công");
  }
}

export async function deleteItemAction(formData: FormData) {
  const admin = await requireOwner().catch(() => null);
  if (!admin) err("Không có quyền");
  const id = Number(formData.get("id"));
  await prisma.flashSaleItem.delete({ where: { id } });
  await audit(admin!.id, "flashsale.item_delete", `#${id}`);
  ok("Đã gỡ gói khỏi Flash Sale");
}
