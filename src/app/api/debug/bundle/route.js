import { NextResponse } from "next/server";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";
import { hasValidCliToken } from "@/dashboardGuard";
import { buildDebugBundle } from "@/lib/debugBundle";

export const dynamic = "force-dynamic";

const VALID_PERIODS = new Set(["24h", "7d", "30d", "all"]);

/**
 * GET /api/debug/bundle — downloadable diagnostic snapshot for bug reports.
 * Administrator (or local CLI) only; every credential-shaped field is redacted.
 */
export async function GET(request) {
  try {
    const account = await getDashboardAccount(request);
    const isAdmin = account?.role === "admin";
    if (!isAdmin && !(await hasValidCliToken(request))) {
      return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const requestedPeriod = searchParams.get("period") || "24h";
    const period = VALID_PERIODS.has(requestedPeriod) ? requestedPeriod : "24h";
    const detailLimit = Number(searchParams.get("details")) || 50;

    const bundle = await buildDebugBundle({ period, detailLimit });
    const stamp = bundle.generatedAt.replace(/[:.]/g, "-");

    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="9router-debug-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[API] Failed to build debug bundle:", error);
    return NextResponse.json({ error: error?.message || "Failed to build debug bundle" }, { status: 500 });
  }
}
