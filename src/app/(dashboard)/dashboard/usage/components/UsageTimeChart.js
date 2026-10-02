"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Card from "@/shared/components/Card";
import SegmentedControl from "@/shared/components/SegmentedControl";
import { Spinner } from "@/shared/components";
import {
  buildModelChartSeries,
  normalizeUsageChartPoints,
  normalizeUsageChartSeries,
  usageChartHasData,
} from "@/shared/utils/usageChart";
import {
  CHART_COLORS,
  CHART_GRID,
  CHART_TICK,
  CHART_TOOLTIP_LABEL,
  CHART_TOOLTIP_STYLE,
} from "@/shared/utils/chartTheme";

const METRICS = [
  { value: "tokens", label: "Tokens" },
  { value: "cost", label: "Cost" },
  { value: "requests", label: "Requests" },
];

const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const EXACT = new Intl.NumberFormat("en-US");

const CHART_MARGIN = { top: 10, right: 8, left: 0, bottom: 0 };
const TOOLTIP_CURSOR = { stroke: "var(--border)", strokeWidth: 1 };

function fmtTokens(value) {
  return COMPACT.format(Number(value) || 0);
}
function fmtRequests(value) {
  return EXACT.format(Math.round(Number(value) || 0));
}
function fmtCost(value) {
  const amount = Number(value) || 0;
  return `$${amount.toFixed(amount > 0 && amount < 0.01 ? 4 : 2)}`;
}

function axisFormatter(metric) {
  if (metric === "cost") return (value) => `$${COMPACT.format(Number(value) || 0)}`;
  if (metric === "requests") return (value) => COMPACT.format(Number(value) || 0);
  return (value) => COMPACT.format(Number(value) || 0);
}

function tooltipFormatter(metric) {
  if (metric === "cost") return (value, name) => [fmtCost(value), name];
  if (metric === "requests") return (value, name) => [fmtRequests(value), name];
  return (value, name) => [fmtTokens(value), name];
}

function formatTotal(metric, points) {
  const sum = (key) => points.reduce((total, point) => total + (Number(point[key]) || 0), 0);
  if (metric === "cost") return fmtCost(sum("cost"));
  if (metric === "requests") return fmtRequests(sum("requests"));
  return fmtTokens(sum("tokens"));
}

function Legend({ items }) {
  if (!items.length) return null;
  return (
    <ul className="mt-3 flex min-h-6 flex-wrap content-start gap-x-3 gap-y-1.5" aria-label="Chart legend">
      {items.map((item) => (
        <li key={item.dataKey} className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden />
          <span className="max-w-36 truncate" title={item.name}>{item.name}</span>
        </li>
      ))}
    </ul>
  );
}

Legend.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      dataKey: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

export default function UsageTimeChart({ period = "7d", scope, apiKeyId = "all" }) {
  const [points, setPoints] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [metric, setMetric] = useState("tokens");
  const [breakdown, setBreakdown] = useState(true);

  const fetchData = useCallback(async (signal) => {
    setFetching(true);
    try {
      const params = new URLSearchParams({ period });
      if (scope) params.set("scope", scope);
      if (apiKeyId && apiKeyId !== "all") params.set("apiKeyId", apiKeyId);
      const response = await fetch(`/api/usage/chart?${params}`, { cache: "no-store", signal });
      if (!response.ok) throw new Error("Unable to load usage chart");
      const payload = await response.json();
      setPoints(normalizeUsageChartPoints(payload));
      setSeries(normalizeUsageChartSeries(payload));
    } catch (error) {
      if (error?.name !== "AbortError") {
        setPoints([]);
        setSeries([]);
      }
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [period, scope, apiKeyId]);

  useEffect(() => {
    const controller = new AbortController();
    const id = window.setTimeout(() => fetchData(controller.signal), 0);
    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [fetchData]);

  const modelSeries = useMemo(
    () => buildModelChartSeries(points, series, metric === "requests" ? "requests" : metric === "cost" ? "cost" : "tokens"),
    [points, series, metric],
  );

  const seriesItems = useMemo(() => {
    if (breakdown && modelSeries.length) {
      return modelSeries.map((item) => ({ dataKey: item.dataKey, name: item.name, color: item.color }));
    }
    if (metric === "tokens") {
      return [
        { dataKey: "promptTokens", name: "Input", color: CHART_COLORS.input },
        { dataKey: "completionTokens", name: "Output", color: CHART_COLORS.output },
      ];
    }
    if (metric === "cost") return [{ dataKey: "cost", name: "Cost", color: CHART_COLORS.cost }];
    return [{ dataKey: "requests", name: "Requests", color: CHART_COLORS.requests }];
  }, [breakdown, modelSeries, metric]);

  const hasData = usageChartHasData(points);
  const periodTotal = formatTotal(metric, points);

  const renderSeries = () => {
    if (metric === "requests") {
      return seriesItems.map((item) => (
        <Bar
          key={item.dataKey}
          dataKey={item.dataKey}
          name={item.name}
          stackId="requests"
          fill={item.color}
          fillOpacity={0.85}
          radius={[2, 2, 0, 0]}
          maxBarSize={38}
          isAnimationActive={false}
        />
      ));
    }
    if (metric === "cost") {
      return seriesItems.map((item) => (
        <Area
          key={item.dataKey}
          type="monotone"
          dataKey={item.dataKey}
          name={item.name}
          stackId="cost"
          stroke={item.color}
          fill={item.color}
          fillOpacity={item.dataKey === "cost" ? 0.18 : 0.3}
          strokeWidth={1.75}
          isAnimationActive={false}
        />
      ));
    }
    return seriesItems.map((item) => (
      <Area
        key={item.dataKey}
        type="monotone"
        dataKey={item.dataKey}
        name={item.name}
        stackId="tokens"
        stroke={item.color}
        fill={item.color}
        fillOpacity={0.32}
        strokeWidth={1.5}
        isAnimationActive={false}
      />
    ));
  };

  return (
    <Card padding="none" className="min-w-0 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h2 className="font-mono text-sm font-semibold text-foreground">Usage over time</h2>
            <span className="font-mono text-sm tabular-nums text-muted-foreground">{periodTotal}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Hourly buckets for the selected period{fetching ? " · updating…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl options={METRICS} value={metric} onChange={setMetric} size="sm" />
          <button
            type="button"
            onClick={() => setBreakdown((value) => !value)}
            aria-pressed={breakdown}
            className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
              breakdown
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            By model
          </button>
          {fetching ? <Spinner size="xs" /> : null}
        </div>
      </div>

      <div className="px-1 pb-1 pt-4 sm:px-3">
        {loading ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
            <Spinner size="sm" />
          </div>
        ) : !hasData ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
            No usage in this period.
          </div>
        ) : (
          <div className={fetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <div className="h-[320px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={points} margin={CHART_MARGIN} accessibilityLayer>
                  <CartesianGrid vertical={false} {...CHART_GRID} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={CHART_TICK}
                    tickMargin={10}
                    minTickGap={20}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={CHART_TICK}
                    tickFormatter={axisFormatter(metric)}
                    width={metric === "cost" ? 56 : 48}
                    allowDecimals={metric !== "requests"}
                  />
                  <Tooltip
                    cursor={TOOLTIP_CURSOR}
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL}
                    formatter={tooltipFormatter(metric)}
                    itemSorter={(item) => -Number(item.value) || 0}
                  />
                  {renderSeries()}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <Legend items={seriesItems} />
          </div>
        )}
      </div>
    </Card>
  );
}

UsageTimeChart.propTypes = {
  period: PropTypes.string,
  scope: PropTypes.string,
  apiKeyId: PropTypes.string,
};
