"use client";

import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SectionLabel, PeriodDropdown } from "@/shared/components";
import { normalizeUsageChartPoints } from "@/shared/utils/usageChart";
import {
  CHART_COLORS,
  CHART_GRID,
  CHART_TICK,
  CHART_TOOLTIP_LABEL,
  CHART_TOOLTIP_STYLE,
} from "@/shared/utils/chartTheme";

const fmtNum = (v) => {
  const n = Number(v) || 0;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};
const fmtCost = (v) => `$${(Number(v) || 0).toFixed(2)}`;

const tooltipCursor = { stroke: "var(--color-border)", strokeWidth: 1 };

function MiniChart({ label, total, children }) {
  return (
    <div className="min-w-0 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</span>
        {total != null && <span className="font-mono text-xs tabular-nums text-text-subtle">{total}</span>}
      </div>
      <div className="h-[220px] min-w-0">{children}</div>
    </div>
  );
}

MiniChart.propTypes = { label: PropTypes.string.isRequired, total: PropTypes.node, children: PropTypes.node };

const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };

function XAxisShared() {
  return (
    <XAxis
      dataKey="label"
      tickLine={false}
      axisLine={false}
      tick={CHART_TICK}
      tickMargin={8}
      interval="preserveStartEnd"
    />
  );
}

export default function UsageOverTime({ period, onPeriodChange, apiKeyId = "all", scope = "account", title = "Usage Over Time" }) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (apiKeyId !== "all") params.set("apiKeyId", apiKeyId);
      if (scope === "system") params.set("scope", "system");
      const response = await fetch(`/api/usage/chart?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load usage over time");
      const data = await response.json();
      setPoints(normalizeUsageChartPoints(data));
    } catch {
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [period, apiKeyId, scope]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchData, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchData]);

  const totalRequests = points.reduce((sum, p) => sum + (Number(p.requests) || 0), 0);
  const totalCost = points.reduce((sum, p) => sum + (Number(p.cost) || 0), 0);
  const totalTokens = points.reduce((sum, p) => sum + (Number(p.tokens) || 0), 0);
  const hasData = points.length > 0 && (totalRequests > 0 || totalCost > 0 || totalTokens > 0);

  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <SectionLabel className="!mb-0">{title}</SectionLabel>
        {onPeriodChange && <PeriodDropdown value={period} onChange={onPeriodChange} disabled={loading} />}
      </div>

      {loading ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-text-muted">Loading trend…</div>
      ) : !hasData ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-text-muted">No usage in this period.</div>
      ) : (
        <div className="tile-grid grid-cols-1 md:grid-cols-3">
          <MiniChart label="Requests" total={fmtNum(totalRequests)}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={CHART_MARGIN}>
                <CartesianGrid vertical={false} {...CHART_GRID} />
                <XAxisShared />
                <YAxis tickLine={false} axisLine={false} tick={CHART_TICK} tickFormatter={fmtNum} width={40} />
                <Tooltip
                  cursor={tooltipCursor}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL}
                  formatter={(value) => [fmtNum(value), "Requests"]}
                />
                <Area
                  type="monotone"
                  dataKey="requests"
                  name="Requests"
                  stroke={CHART_COLORS.requests}
                  fill={CHART_COLORS.requests}
                  fillOpacity={0.22}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </MiniChart>

          <MiniChart label="Spend" total={fmtCost(totalCost)}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={CHART_MARGIN}>
                <CartesianGrid vertical={false} {...CHART_GRID} />
                <XAxisShared />
                <YAxis tickLine={false} axisLine={false} tick={CHART_TICK} tickFormatter={(v) => `$${(v || 0).toFixed(2)}`} width={48} />
                <Tooltip
                  cursor={tooltipCursor}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL}
                  formatter={(value) => [fmtCost(value), "Spend"]}
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  name="Spend"
                  stroke={CHART_COLORS.cost}
                  fill={CHART_COLORS.cost}
                  fillOpacity={0.22}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </MiniChart>

          <MiniChart label="Tokens (in · out)" total={fmtNum(totalTokens)}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={CHART_MARGIN}>
                <CartesianGrid vertical={false} {...CHART_GRID} />
                <XAxisShared />
                <YAxis tickLine={false} axisLine={false} tick={CHART_TICK} tickFormatter={fmtNum} width={40} />
                <Tooltip
                  cursor={tooltipCursor}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL}
                  formatter={(value, name) => [fmtNum(value), name]}
                />
                <Area
                  type="monotone"
                  dataKey="promptTokens"
                  name="Input"
                  stackId="tokens"
                  stroke={CHART_COLORS.input}
                  fill={CHART_COLORS.input}
                  fillOpacity={0.26}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="completionTokens"
                  name="Output"
                  stackId="tokens"
                  stroke={CHART_COLORS.output}
                  fill={CHART_COLORS.output}
                  fillOpacity={0.26}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </MiniChart>
        </div>
      )}
    </div>
  );
}

UsageOverTime.propTypes = {
  period: PropTypes.string.isRequired,
  onPeriodChange: PropTypes.func,
  apiKeyId: PropTypes.string,
  scope: PropTypes.oneOf(["account", "system"]),
  title: PropTypes.string,
};
