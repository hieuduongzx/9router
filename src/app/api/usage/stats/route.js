import { NextResponse } from "next/server";
import { getUsageStats } from "@/lib/usageDb";
import { getApiKeyById, getApiKeys } from "@/lib/localDb";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";

const VALID_PERIODS = new Set(["today", "5m", "15m", "1h", "6h", "12h", "24h", "3d", "7d", "14d", "30d", "60d", "all"]);

export const dynamic = "force-dynamic";

/** Resolve ?apiKeyId= to internal filter value for usageRepo. */
async function resolveApiKeyFilter(apiKeyId, owner, systemScope) {
  if (systemScope) return owner.role === "admin" ? null : "__none__";
  if (!apiKeyId || apiKeyId === "all") {
    const keys = await getApiKeys(owner.id);
    return keys.map((key) => key.key);
  }
  if (apiKeyId === "local") return "__none__";
  try {
    const key = await getApiKeyById(apiKeyId, owner.id);
    return key?.key || "__none__";
  } catch {
    return "__none__";
  }
}

export async function GET(request) {
  try {
    const owner = await getDashboardAccount(request);
    if (!owner) return NextResponse.json({ error: "Account login required" }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";
    const apiKeyId = searchParams.get("apiKeyId") || "all";
    const systemScope = searchParams.get("scope") === "system";

    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const apiKeyFilter = await resolveApiKeyFilter(apiKeyId, owner, systemScope);
    const stats = await getUsageStats(period, {
      apiKeyFilter,
      forceHistory: systemScope,
    });
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[API] Failed to get usage stats:", error);
    return NextResponse.json({ error: "Failed to fetch usage stats" }, { status: 500 });
  }
}
