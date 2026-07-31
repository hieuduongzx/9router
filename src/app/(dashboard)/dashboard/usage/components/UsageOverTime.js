"use client";

import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { SectionLabel, PeriodDropdown } from "@/shared/components";
import { normalizeUsageChartPoints } from "@/shared/utils/usageChart";

const INPUT_COLOR = "#7C3AED";
const OUTPUT_COLOR = "#2563EB";

const fmtNum = (v) => {
  const n = Number(v) || 0;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};
const fmtCost = (v) => `$${(Number(v) || 0).toFixed(2)}`;

const tooltipStyle = {
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "0px",
  color: "var(--color-text-main)",
  fontSize: "11px",
  fontFamily: "var(--font-mono)",
};
const tooltipCursor = { fill: "var(--color-surface-2)", opacity: 0.7 };
const axisTick = { fill: "var(--color-text-muted)", fontSize: 10 };

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

export default function UsageOverTime({ period, onPeriodChange, apiKeyId = "all", scope = "account", title = "Usage Over Time" }) {
  const [points, setPoints] = useState([]);
  const [series, setSeries] = useState([]);
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
      setSeries(Array.isArray(data?.series) ? data.series : []);
    } catch {
      setPoints([]);
      setSeries([]);
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
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <SectionLabel className="!mb-0">{title}</SectionLabel>
        {onPeriodChange && <PeriodDropdown value={period} onChange={onPeriodChange} disabled={loading} />}
      </div>

      {loading ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-text-muted">Loading trend…</div>
      ) : !hasData ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-text-muted">No usage in this period.</div>
      ) : (
        <div className="tile-grid grid-cols-1 md:grid-cols-3">
          <MiniChart label="Requests by model" total={fmtNum(totalRequests)}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.65} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} tickMargin={8} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={fmtNum} width={40} />
                <Tooltip cursor={tooltipCursor} contentStyle={tooltipStyle} formatter={(value, name) => [fmtNum(value), name]} />
                {series.map((s) => (
                  <Bar
                    key={s.id}
                    dataKey={`r_${s.id}`}
                    name={s.name}
                    stackId="requests"
                    fill={s.color}
                    maxBarSize={28}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </MiniChart>

          <MiniChart label="Spend by model" total={fmtCost(totalCost)}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.65} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} tickMargin={8} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(v) => `$${(v || 0).toFixed(2)}`} width={48} />
                <Tooltip cursor={tooltipCursor} contentStyle={tooltipStyle} formatter={(value, name) => [fmtCost(value), name]} />
                {series.map((s) => (
                  <Bar
                    key={s.id}
                    dataKey={`c_${s.id}`}
                    name={s.name}
                    stackId="spend"
                    fill={s.color}
                    maxBarSize={28}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </MiniChart>

          <MiniChart label="Input + output tokens" total={fmtNum(totalTokens)}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.65} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} tickMargin={8} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={fmtNum} width={40} />
                <Tooltip cursor={tooltipCursor} contentStyle={tooltipStyle} formatter={(value, name) => [fmtNum(value), name]} />
                <Bar
                  dataKey="promptTokens"
                  name="Input"
                  stackId="tokens"
                  fill={INPUT_COLOR}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="completionTokens"
                  name="Output"
                  stackId="tokens"
                  fill={OUTPUT_COLOR}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
              </BarChart>
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
