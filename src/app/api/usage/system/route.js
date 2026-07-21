import { NextResponse } from "next/server";
import { getSystemUsageOverview } from "@/lib/usageDb";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";

const VALID_PERIODS = new Set(["today", "24h", "7d", "30d", "60d", "all"]);

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const account = await getDashboardAccount(request);
    if (account?.role !== "admin") {
      return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    }

    const period = new URL(request.url).searchParams.get("period") || "today";
    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    return NextResponse.json(await getSystemUsageOverview(period));
  } catch (error) {
    console.error("[API] Failed to get system usage:", error);
    return NextResponse.json({ error: "Failed to fetch system usage" }, { status: 500 });
  }
}
