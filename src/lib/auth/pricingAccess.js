import { getDashboardAccount } from "@/lib/auth/dashboardSession";

/**
 * Pricing writes belong to administrators.
 *
 * This used to also require the caller to be in the "admin view" — a cookie the
 * dashboard set independently of which shell you were actually looking at. The
 * two desynchronised constantly, so a real administrator standing in
 * /admin/router would be handed read-only rates for no visible reason, while
 * `PATCH /api/pricing` accepted the write anyway (the guard gates it on role
 * alone). The flag now reports what the server actually enforces.
 *
 * Fail-closed: any lookup problem denies the capability.
 */
export async function canEditPricing(request) {
  try {
    const account = await getDashboardAccount(request);
    return account?.role === "admin";
  } catch {
    return false;
  }
}
