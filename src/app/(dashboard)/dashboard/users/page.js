import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { getUserById } from "@/lib/localDb";
import UsersPageClient from "./UsersPageClient";

export default async function UsersPage() {
  const cookieStore = await cookies();
  const session = await getDashboardAuthSession(cookieStore.get("auth_token")?.value);
  const user = session?.userId ? await getUserById(session.userId) : null;
  if (!user?.isActive || user.role !== "admin") redirect("/dashboard");
  return <UsersPageClient />;
}
