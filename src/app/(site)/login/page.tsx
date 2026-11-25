import { redirect } from "next/navigation";

export default async function LoginShim({ searchParams }: { searchParams: Promise<{ err?: string; next?: string }> }) {
  const { err, next } = await searchParams;
  const q = new URLSearchParams({ auth: "login" });
  if (err) q.set("err", err);
  if (next) q.set("next", next);
  redirect("/?" + q.toString());
}
