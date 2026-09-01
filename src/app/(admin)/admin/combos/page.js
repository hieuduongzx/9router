import { redirect } from "next/navigation";

/** Legacy path — Model Routes lives at /admin/router now. */
export default function AdminCombosRedirect() {
  redirect("/admin/router");
}
