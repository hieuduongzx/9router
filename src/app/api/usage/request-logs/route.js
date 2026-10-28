import { NextResponse } from "next/server";
import { getRequestLogsPage, USAGE_STATUS_BUCKETS } from "@/lib/usageDb";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";

const VALID_PERIODS = new Set(["today", "5m", "15m", "1h", "6h", "12h", "24h", "3d", "7d", "14d", "30d", "60d", "all"]);
const VALID_PAGE_SIZES = new Set([10, 30, 50, 100]);
const VALID_STATUSES = new Set(USAGE_STATUS_BUCKETS);
// Filter values are matched with bound parameters, never interpolated; the cap
// only stops an absurd query string from being echoed into SQL params.
const MAX_FILTER_LENGTH = 200;

function readFilter(searchParams, name) {
  const value = (searchParams.get(name) || "").trim();
  return value ? value.slice(0, MAX_FILTER_LENGTH) : "";
}

function isValidDate(value) {
  return !value || !Number.isNaN(new Date(value).getTime());
}

/**
 * GET /api/usage/request-logs (admin)
 * Query: period, page, pageSize, and optional filters userId, apiKeyId, model,
 * provider, status (success | error | rate_limited), startDate, endDate.
 * startDate/endDate override the period window when present.
 */
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

    const filters = {
      userId: readFilter(searchParams, "userId"),
      apiKeyId: readFilter(searchParams, "apiKeyId"),
      model: readFilter(searchParams, "model"),
      provider: readFilter(searchParams, "provider"),
      status: readFilter(searchParams, "status"),
      startDate: readFilter(searchParams, "startDate"),
      endDate: readFilter(searchParams, "endDate"),
    };
    if (filters.status && !VALID_STATUSES.has(filters.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (!isValidDate(filters.startDate) || !isValidDate(filters.endDate)) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    return NextResponse.json(await getRequestLogsPage({ period, page, pageSize, filters }));
  } catch (error) {
    console.error("[API ERROR] /api/usage/request-logs failed:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
