import { getDashboardAccount } from "@/lib/auth/dashboardSession";
import {
  DASHBOARD_VIEW_ADMIN,
  DASHBOARD_VIEW_COOKIE,
  resolveDashboardViewMode,
} from "@/shared/constants/dashboardView";

/**
 * Pricing writes belong to administrators, and only while they are actually in
 * the admin view — an admin previewing the user dashboard sees read-only rates.
 * Fail-closed: any lookup problem denies the capability.
 */
export async function canEditPricing(request) {
  try {
    const account = await getDashboardAccount(request);
    const viewMode = resolveDashboardViewMode(
      account?.role,
      request?.cookies?.get?.(DASHBOARD_VIEW_COOKIE)?.value,
    );
    return account?.role === "admin" && viewMode === DASHBOARD_VIEW_ADMIN;
  } catch {
    return false;
  }
}
