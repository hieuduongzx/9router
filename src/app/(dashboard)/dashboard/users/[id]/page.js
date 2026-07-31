import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { getUserById, publicUser } from "@/lib/db/index.js";
import UserDetailsClient from "./UserDetailsClient";

export default async function UserDetailsPage({ params }) {
  const cookieStore = await cookies();
  const session = await getDashboardAuthSession(cookieStore.get("auth_token")?.value);
  const admin = session?.userId ? await getUserById(session.userId) : null;
  if (!admin?.isActive || admin.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();
  // publicUser strips the password hash — this object is serialized into the page payload.
  return <UserDetailsClient initialUser={publicUser(user)} currentUserId={admin.id} />;
}
