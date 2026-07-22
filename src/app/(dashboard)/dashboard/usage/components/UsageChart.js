"use client";

import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Card from "@/shared/components/Card";
import { normalizeUsageChartPoints } from "@/shared/utils/usageChart";

const fmtTokens = (value) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value || 0);
};
const fmtCost = (value) => `$${(value || 0).toFixed(4)}`;


export default function UsageChart({ period = "7d", apiKeyId = "all" }) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("tokens");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (apiKeyId !== "all") params.set("apiKeyId", apiKeyId);
      const response = await fetch(`/api/usage/chart?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load usage trend");
      setPoints(normalizeUsageChartPoints(await response.json()));
    } catch {
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [period, apiKeyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasData = points.some((point) => Number(point.tokens) > 0 || Number(point.cost) > 0);
  const dataKey = viewMode === "tokens" ? "tokens" : "cost";
  const color = viewMode === "tokens" ? "#6366f1" : "#f59e0b";
  const formatter = viewMode === "tokens" ? fmtTokens : fmtCost;

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-main">Model consumption trend</h2>
          <p className="mt-0.5 text-xs text-text-muted">Aggregate tokens and estimated cost across routed models.</p>
        </div>
        <div className="grid w-full grid-cols-2 items-center gap-1 rounded-lg border border-border bg-bg-subtle p-1 sm:w-auto">
          <button
            type="button"
            onClick={() => setViewMode("tokens")}
            aria-pressed={viewMode === "tokens"}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${viewMode === "tokens" ? "bg-primary text-white shadow-sm" : "text-text-muted hover:bg-bg-hover hover:text-text"}`}
          >
            Tokens
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cost")}
            aria-pressed={viewMode === "cost"}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${viewMode === "cost" ? "bg-primary text-white shadow-sm" : "text-text-muted hover:bg-bg-hover hover:text-text"}`}
          >
            Cost
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-sm text-text-muted">Loading trend…</div>
      ) : !hasData ? (
        <div className="flex h-48 items-center justify-center text-sm text-text-muted">No model usage in this period.</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`usage-${dataKey}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.5 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.5 }} tickLine={false} axisLine={false} tickFormatter={formatter} width={50} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value) => [formatter(value), viewMode === "tokens" ? "Tokens" : "Cost"]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              name={viewMode === "tokens" ? "Tokens" : "Cost"}
              stroke={color}
              strokeWidth={2}
              fill={`url(#usage-${dataKey}-fill)`}
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

UsageChart.propTypes = {
  period: PropTypes.string,
  apiKeyId: PropTypes.string,
};
