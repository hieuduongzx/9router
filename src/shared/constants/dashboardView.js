export const DASHBOARD_VIEW_COOKIE = "dashboard_view_mode";
export const DASHBOARD_VIEW_ADMIN = "admin";
export const DASHBOARD_VIEW_USER = "user";

export function resolveDashboardViewMode(role, requestedMode) {
  if (role !== "admin") return DASHBOARD_VIEW_USER;
  return requestedMode === DASHBOARD_VIEW_USER ? DASHBOARD_VIEW_USER : DASHBOARD_VIEW_ADMIN;
}
