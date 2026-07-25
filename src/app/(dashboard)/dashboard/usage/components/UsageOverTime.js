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
import { SectionLabel, PeriodDropdown } from "@/shared/components";
import { normalizeUsageChartPoints } from "@/shared/utils/usageChart";

const INPUT_COLOR = "#6366f1";
const OUTPUT_COLOR = "#2f9e8f";

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
  boxShadow: "var(--shadow-elevated)",
  color: "var(--color-text-main)",
  fontSize: "12px",
  fontFamily: "var(--font-mono)",
};
const tooltipCursor = { stroke: "var(--color-border)", strokeWidth: 1 };
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

export default function UsageOverTime({ period, onPeriodChange, apiKeyId = "all" }) {
  const [points, setPoints] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (apiKeyId !== "all") params.set("apiKeyId", apiKeyId);
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
  }, [period, apiKeyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalRequests = points.reduce((sum, p) => sum + (Number(p.requests) || 0), 0);
  const totalCost = points.reduce((sum, p) => sum + (Number(p.cost) || 0), 0);
  const totalTokens = points.reduce((sum, p) => sum + (Number(p.tokens) || 0), 0);
  const hasData = points.length > 0 && (totalRequests > 0 || totalCost > 0 || totalTokens > 0);

  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <SectionLabel className="!mb-0">Usage Over Time</SectionLabel>
        {onPeriodChange && <PeriodDropdown value={period} onChange={onPeriodChange} disabled={loading} />}
      </div>

      {loading ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-text-muted">Loading trend…</div>
      ) : !hasData ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-text-muted">No usage in this period.</div>
      ) : (
        <div className="tile-grid grid-cols-1 md:grid-cols-3">
          <MiniChart label="Requests by Model" total={fmtNum(totalRequests)}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  {series.map((s, i) => (
                    <linearGradient key={s.id} id={`reqFill${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.65} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} tickMargin={8} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={fmtNum} width={40} />
                <Tooltip cursor={tooltipCursor} contentStyle={tooltipStyle} formatter={(value, name) => [fmtNum(value), name]} />
                {series.map((s, i) => (
                  <Area
                    key={s.id}
                    type="monotone"
                    dataKey={`r_${s.id}`}
                    name={s.name}
                    stroke={s.color}
                    strokeWidth={2.5}
                    fill={`url(#reqFill${i})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, fill: s.color, stroke: "var(--color-surface)" }}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </MiniChart>

          <MiniChart label="Spend by Model" total={fmtCost(totalCost)}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  {series.map((s, i) => (
                    <linearGradient key={s.id} id={`costFill${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.65} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} tickMargin={8} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(v) => `$${(v || 0).toFixed(2)}`} width={48} />
                <Tooltip cursor={tooltipCursor} contentStyle={tooltipStyle} formatter={(value, name) => [fmtCost(value), name]} />
                {series.map((s, i) => (
                  <Area
                    key={s.id}
                    type="monotone"
                    dataKey={`c_${s.id}`}
                    name={s.name}
                    stroke={s.color}
                    strokeWidth={2.5}
                    fill={`url(#costFill${i})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, fill: s.color, stroke: "var(--color-surface)" }}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </MiniChart>

          <MiniChart label="All Tokens" total={fmtNum(totalTokens)}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="tokenInputFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={INPUT_COLOR} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={INPUT_COLOR} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="tokenOutputFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={OUTPUT_COLOR} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={OUTPUT_COLOR} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.65} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} tickMargin={8} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={fmtNum} width={40} />
                <Tooltip cursor={tooltipCursor} contentStyle={tooltipStyle} formatter={(value, name) => [fmtNum(value), name]} />
                <Area
                  type="monotone"
                  dataKey="promptTokens"
                  name="Input"
                  stroke={INPUT_COLOR}
                  strokeWidth={2.5}
                  fill="url(#tokenInputFill)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, fill: INPUT_COLOR, stroke: "var(--color-surface)" }}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="completionTokens"
                  name="Output"
                  stroke={OUTPUT_COLOR}
                  strokeWidth={2.5}
                  fill="url(#tokenOutputFill)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, fill: OUTPUT_COLOR, stroke: "var(--color-surface)" }}
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
};
