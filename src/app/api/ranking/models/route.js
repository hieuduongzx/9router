import { NextResponse } from "next/server";
import { getModelRanking } from "@/lib/db";

// Public, unauthenticated leaderboard of the most-used models across the
// whole system. Mirrors /api/catalog/models: no getDashboardAccount gate —
// anyone may read aggregate model rankings. Only model-level aggregates ever
// leave this route; per-user / per-key / per-account dimensions are stripped
// (and never enter the repo result in the first place), and so is cost.
const VALID_PERIODS = new Set(["1h", "6h", "12h", "24h", "today", "3d", "7d", "14d", "30d", "all"]);
const VALID_SORTS = new Set(["requests", "tokens"]);
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";
    const sort = searchParams.get("sort") || "requests";

    let limit = Number.parseInt(searchParams.get("limit") ?? "", 10);
    if (!Number.isFinite(limit)) limit = DEFAULT_LIMIT;
    limit = Math.min(Math.max(limit, 1), MAX_LIMIT);

    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }
    if (!VALID_SORTS.has(sort)) {
      return NextResponse.json({ error: "Invalid sort" }, { status: 400 });
    }

    const ranking = await getModelRanking(period, { sort });

    return NextResponse.json(
      {
        period: ranking.period,
        sort: ranking.sort,
        generatedAt: ranking.generatedAt,
        totalRequests: ranking.totalRequests,
        totalPromptTokens: ranking.totalPromptTokens,
        totalCompletionTokens: ranking.totalCompletionTokens,
        totalTokens: ranking.totalTokens,
        models: ranking.models.slice(0, limit).map(({ cost, ...publicEntry }) => publicEntry),
      },
      // Aggregate data changes slowly — let a CDN hold it briefly without
      // letting browsers serve stale content on back-navigation.
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (error) {
    console.error("[API] Failed to get model ranking:", error);
    return NextResponse.json({ error: "Failed to fetch model ranking" }, { status: 500 });
  }
}
