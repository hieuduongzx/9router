import { NextResponse } from "next/server";
import { getRequestLogsPage } from "@/lib/usageDb";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";

const VALID_PERIODS = new Set(["today", "5m", "15m", "1h", "6h", "12h", "24h", "3d", "7d", "14d", "30d", "60d", "all"]);
const VALID_PAGE_SIZES = new Set([10, 30, 50, 100]);

export async function GET(request) {
  try {
    const account = await getDashboardAccount(request);
    if (account?.role !== "admin") {
      return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    }
    const searchParams = new URL(request.url).searchParams;
    const period = searchParams.get("period") || "all";
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 30);
    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }
    if (!Number.isInteger(page) || page < 1) {
      return NextResponse.json({ error: "Invalid page" }, { status: 400 });
    }
    if (!VALID_PAGE_SIZES.has(pageSize)) {
      return NextResponse.json({ error: "Invalid page size" }, { status: 400 });
    }

    return NextResponse.json(await getRequestLogsPage({ period, page, pageSize }));
  } catch (error) {
    console.error("[API ERROR] /api/usage/logs failed:", error);
    console.error("[API ERROR] Stack:", error?.stack);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
