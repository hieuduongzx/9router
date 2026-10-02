import { redirect } from "next/navigation";

// System usage now lives inside Activity (System tab). Keep this route so old
// bookmarks and links land somewhere useful instead of 404-ing.
export default function AdminUsagePage() {
  redirect("/admin/activity");
}
