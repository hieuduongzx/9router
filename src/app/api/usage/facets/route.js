import { NextResponse } from "next/server";
import { getUsageFacets } from "@/lib/usageDb";
import { getApiKeys, getUserById } from "@/lib/localDb";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";

/**
 * GET /api/usage/facets
 * Options for usage filter dropdowns: models, providers and outcome buckets that
 * occur in the caller's scope.
 *
 * Scope follows the request-details contract: the signed-in account's own keys
 * by default; `userId` (admin) for one account; `scope=system` (admin) for every
 * request, including keyless local traffic.
 */
export async function GET(request) {
  try {
    const owner = await getDashboardAccount(request);
    if (!owner) return NextResponse.json({ error: "Account login required" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope");
    const userId = searchParams.get("userId");
    const isAdmin = owner.role === "admin";

    if ((scope === "system" || userId) && !isAdmin) {
      return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    }

    let apiKeyFilter = null;
    if (scope !== "system") {
      if (userId && !(await getUserById(userId))) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      const keys = await getApiKeys(userId || owner.id);
      apiKeyFilter = keys.map((key) => key.key);
    }

    return NextResponse.json(await getUsageFacets({ apiKeyFilter }));
  } catch (error) {
    console.error("[API] Failed to get usage facets:", error);
    return NextResponse.json({ error: "Failed to fetch filter options" }, { status: 500 });
  }
}
