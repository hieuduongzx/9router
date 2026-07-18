import { NextResponse } from "next/server";
import { getUsageStats } from "@/lib/usageDb";
import { getApiKeyById } from "@/lib/localDb";

const VALID_PERIODS = new Set(["today", "24h", "7d", "30d", "60d", "all"]);

export const dynamic = "force-dynamic";

/** Resolve ?apiKeyId= to internal filter value for usageRepo. */
async function resolveApiKeyFilter(apiKeyId) {
  if (!apiKeyId || apiKeyId === "all") return null;
  if (apiKeyId === "local") return "__local__";
  try {
    const key = await getApiKeyById(apiKeyId);
    return key?.key || "__none__";
  } catch {
    return "__none__";
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";
    const apiKeyId = searchParams.get("apiKeyId") || "all";

    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const apiKeyFilter = await resolveApiKeyFilter(apiKeyId);
    const stats = await getUsageStats(period, { apiKeyFilter });
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[API] Failed to get usage stats:", error);
    return NextResponse.json({ error: "Failed to fetch usage stats" }, { status: 500 });
  }
}
