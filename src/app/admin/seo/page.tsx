import { redirect } from "next/navigation";

export default function AdminSeoRedirect() {
  redirect("/admin/website?tab=seo");
}
