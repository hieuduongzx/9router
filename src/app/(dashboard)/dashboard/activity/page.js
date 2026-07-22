import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { getUserById } from "@/lib/localDb";
import { CardSkeleton } from "@/shared/components";
import {
  DASHBOARD_VIEW_ADMIN,
  DASHBOARD_VIEW_COOKIE,
  resolveDashboardViewMode,
} from "@/shared/constants/dashboardView";
import ActivityPageClient from "./ActivityPageClient";

export default async function ActivityPage() {
  const cookieStore = await cookies();
  const session = await getDashboardAuthSession(cookieStore.get("auth_token")?.value);
  const user = session?.userId ? await getUserById(session.userId) : null;
  const viewMode = resolveDashboardViewMode(
    user?.role,
    cookieStore.get(DASHBOARD_VIEW_COOKIE)?.value,
  );
  if (!user?.isActive || user.role !== "admin" || viewMode !== DASHBOARD_VIEW_ADMIN) redirect("/dashboard");

  return (
    <Suspense fallback={<CardSkeleton />}>
      <ActivityPageClient />
    </Suspense>
  );
}
