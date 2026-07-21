import { getDashboardAccount } from "@/lib/auth/dashboardSession";
import { getPrimaryAdmin } from "@/lib/db/repos/usersRepo";
import { hasValidCliToken } from "@/dashboardGuard";

export async function resolveApiKeyOwner(request) {
  const account = await getDashboardAccount(request);
  if (account) return account;
  if (await hasValidCliToken(request)) return getPrimaryAdmin();
  return null;
}
