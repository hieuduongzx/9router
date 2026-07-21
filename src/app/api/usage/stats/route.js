import { NextResponse } from "next/server";
import { getUsageStats } from "@/lib/usageDb";
import { getApiKeyById, getApiKeys } from "@/lib/localDb";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";

const VALID_PERIODS = new Set(["today", "24h", "7d", "30d", "60d", "all"]);

export const dynamic = "force-dynamic";

/** Resolve ?apiKeyId= to internal filter value for usageRepo. */
async function resolveApiKeyFilter(apiKeyId, owner) {
  if ((!apiKeyId || apiKeyId === "all") && owner.role === "admin") return null;
  if (!apiKeyId || apiKeyId === "all") {
    const keys = await getApiKeys(owner.id);
    return keys.map((key) => key.key);
  }
  if (apiKeyId === "local") return owner.role === "admin" ? "__local__" : "__none__";
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

    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const apiKeyFilter = await resolveApiKeyFilter(apiKeyId, owner);
    const stats = await getUsageStats(period, { apiKeyFilter });
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[API] Failed to get usage stats:", error);
    return NextResponse.json({ error: "Failed to fetch usage stats" }, { status: 500 });
  }
}
