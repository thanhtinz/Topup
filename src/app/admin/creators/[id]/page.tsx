import { redirect } from "next/navigation";
export default async function OldCreatorDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/partnership/affiliate/${id}`);
}
