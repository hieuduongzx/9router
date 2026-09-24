"use client";

import { useState, useMemo } from "react";
import PropTypes from "prop-types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import Card from "@/shared/components/Card";
import SegmentedControl from "@/shared/components/SegmentedControl";
import {
  CHART_GRID,
  CHART_RAMP,
  CHART_TICK,
  CHART_TOOLTIP_LABEL,
  CHART_TOOLTIP_STYLE,
} from "@/shared/utils/chartTheme";

const fmtTokens = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n || 0);
};

export default function ProviderBarChart({ byProvider }) {
  const [viewMode, setViewMode] = useState("tokens");

  const chartData = useMemo(() => {
    if (!byProvider) return [];
    return Object.entries(byProvider)
      .map(([id, data]) => ({
        name: id,
        tokens: (data.promptTokens || 0) + (data.completionTokens || 0),
        requests: data.requests || 0,
      }))
      .filter((d) => d[viewMode] > 0)
      .sort((a, b) => b[viewMode] - a[viewMode]);
  }, [byProvider, viewMode]);

  const fmt = viewMode === "tokens" ? fmtTokens : String;
  const label = viewMode === "tokens" ? "Tokens" : "Requests";

  return (
    <Card
      padding="sm"
      className="flex min-w-0 flex-col gap-3"
      title="By Provider"
      action={
        <SegmentedControl
          size="sm"
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: "tokens", label: "Tokens" },
            { value: "requests", label: "Requests" },
          ]}
        />
      }
    >
      {!chartData.length ? (
        <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
          No provider usage yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" {...CHART_GRID} vertical={false} />
            <XAxis
              dataKey="name"
              tick={CHART_TICK}
              tickLine={false}
              axisLine={false}
              interval={0}
              tickFormatter={(v) => v.length > 10 ? v.slice(0, 10) + "…" : v}
            />
            <YAxis
              tick={CHART_TICK}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmt}
              width={44}
            />
            <Tooltip
              cursor={CHART_GRID}
              contentStyle={CHART_TOOLTIP_STYLE}
              labelStyle={CHART_TOOLTIP_LABEL}
              formatter={(value) => [fmt(value), label]}
            />
            <Bar dataKey={viewMode} radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_RAMP[i % CHART_RAMP.length]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

ProviderBarChart.propTypes = {
  byProvider: PropTypes.object,
};
