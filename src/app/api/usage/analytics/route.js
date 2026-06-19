import { NextResponse } from "next/server";
import { getChartData, getUsageStats } from "@/lib/usageDb";
import { getRequestDetails } from "@/lib/requestDetailsDb.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";

    const [chartData, stats, detailsResult] = await Promise.all([
      getChartData(period),
      getUsageStats(period),
      getRequestDetails({ page: 1, pageSize: 500 })
    ]);

    const details = detailsResult.details || [];

    const latencyByDate = {};
    const successByDate = {};
    for (const r of details) {
      if (!r.timestamp) continue;
      const d = new Date(r.timestamp);
      let key;
      if (period === "24h") {
        key = d.toLocaleTimeString("en-US", { hour: "2-digit", hour12: false });
      } else {
        key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
      // latency
      if (r.latency?.total) {
        if (!latencyByDate[key]) latencyByDate[key] = { total: 0, count: 0 };
        latencyByDate[key].total += r.latency.total;
        latencyByDate[key].count += 1;
      }
      // success/error
      if (!successByDate[key]) successByDate[key] = { success: 0, errors: 0 };
      if (r.status === "error") {
        successByDate[key].errors += 1;
      } else {
        successByDate[key].success += 1;
      }
    }

    const latencyData = chartData.map((bucket) => {
      const entry = latencyByDate[bucket.label];
      return {
        label: bucket.label,
        avgLatency: entry ? Math.round(entry.total / entry.count) : 0,
      };
    });

    const byProvider = stats.byProvider || {};
    const providerNodeNameMap = {};
    try {
      const { getProviderNodes } = await import("@/lib/localDb.js");
      const nodes = await getProviderNodes();
      for (const node of nodes) {
        if (node.id && node.name) providerNodeNameMap[node.id] = node.name;
      }
    } catch {}

    const costByProvider = Object.entries(byProvider)
      .map(([id, data]) => ({
        name: providerNodeNameMap[id] || id.toUpperCase(),
        cost: data.cost || 0,
        requests: data.requests || 0,
      }))
      .filter((p) => p.cost > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8);

    return NextResponse.json({
      successRate: chartData.map((b) => ({
        label: b.label,
        success: successByDate[b.label]?.success ?? 0,
        errors: successByDate[b.label]?.errors ?? 0,
      })),
      latency: latencyData,
      costByProvider,
    });
  } catch (error) {
    console.error("[API] Failed to get analytics data:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}