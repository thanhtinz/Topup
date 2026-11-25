import { redirect } from "next/navigation";

export default function CreatorApplyRedirect() {
  redirect("/partnership/apply?type=affiliate");
}
