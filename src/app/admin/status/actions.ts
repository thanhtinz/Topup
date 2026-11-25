"use server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { audit, setSetting } from "@/lib/settings";

export async function saveStatusAction(formData: FormData) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/admin/status?err=" + encodeURIComponent("Không có quyền"));
  for (const key of ["website", "api", "payments"]) {
    const v = String(formData.get(`override_${key}`) ?? "auto");
    await setSetting(`status_override_${key}`, ["operational", "degraded", "down"].includes(v) ? v : "auto");
  }
  await setSetting("status_incident_on", formData.get("incident_on") === "1" ? "1" : "0");
  await setSetting("status_incident_title", String(formData.get("incident_title") ?? "").trim().slice(0, 160));
  await setSetting("status_incident_body", String(formData.get("incident_body") ?? "").trim().slice(0, 600));
  await audit(admin!.id, "status.update", "overrides + incident");
  redirect("/admin/status?msg=" + encodeURIComponent("Đã lưu cấu hình trạng thái — trang /status phía khách đã cập nhật"));
}
