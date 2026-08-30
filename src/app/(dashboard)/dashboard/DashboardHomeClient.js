"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, RefreshCw, Wallet } from "lucide-react";
import Card from "@/shared/components/Card";
import PeriodDropdown from "@/shared/components/PeriodDropdown";
import SectionLabel from "@/shared/components/SectionLabel";
import StatTile from "@/shared/components/StatTile";
import { USAGE_PERIODS } from "@/shared/constants/usagePeriods";
import { cn } from "@/shared/utils/cn";
import { normalizeUsageChartPoints } from "@/shared/utils/usageChart";
import {
  CHART_COLORS,
  CHART_GRID,
  CHART_RAMP,
  CHART_TICK,
  CHART_TOOLTIP_LABEL,
  CHART_TOOLTIP_STYLE,
} from "@/shared/utils/chartTheme";
import QuickStartPanel from "./components/QuickStartPanel";

const COLOR_INPUT = CHART_COLORS.input;
const COLOR_OUTPUT = CHART_COLORS.output;
const COLOR_COST = CHART_COLORS.cost;

const STATUS_META = {
  success: { label: "Successful", color: CHART_COLORS.cost },
  error: { label: "Failed", color: CHART_COLORS.danger },
  rate_limited: { label: "Rate limited", color: CHART_COLORS.requests },
  other: { label: "Other", color: CHART_COLORS.info },
};


const DEFAULT_PERIOD = "24h";

/**
 * Per-range extras layered onto the shared period ladder, so Home offers the
 * same windows as Usage and Activity instead of its own shorter set.
 *
 * `compare` names a chart wide enough to also cover the window *before* the
 * selected one; `buckets` is how many of that chart's buckets make up one
 * window, and the deltas come from the pair immediately preceding the displayed
 * one. Ranges with no such chart ("today" is calendar-scoped, "all" unbounded)
 * render no delta rather than a guessed one.
 *
 * `days` drives the "/day average" note; sub-day windows use `costNote`
 * instead, since extrapolating an hour of spend to a daily rate would mislead.
 */
const RANGE_META = {
  today: { days: null, costNote: "Today so far", compare: null },
  "1h": { days: null, costNote: "Over the last hour", compare: { period: "6h", buckets: 4 } },
  "6h": { days: null, costNote: "Over the last 6 hours", compare: { period: "12h", buckets: 12 } },
  "24h": { days: 1, costNote: null, compare: { period: "3d", buckets: 24 } },
  "7d": { days: 7, costNote: null, compare: { period: "14d", buckets: 7 } },
  "30d": { days: 30, costNote: null, compare: { period: "60d", buckets: 30 } },
  all: { days: null, costNote: "Across all recorded usage", compare: null },
};

const RANGES = USAGE_PERIODS.map((period) => ({
  value: period.value,
  label: period.label,
  ...(RANGE_META[period.value] || { days: null, costNote: null, compare: null }),
}));

function findRange(value) {
  return RANGES.find((item) => item.value === value)
    || RANGES.find((item) => item.value === DEFAULT_PERIOD);
}

const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const plainNumber = new Intl.NumberFormat("en");

function formatNumber(value) {
  return compactNumber.format(Number(value) || 0);
}

function formatExact(value) {
  return plainNumber.format(Number(value) || 0);
}

function formatCurrency(value) {
  const amount = Number(value) || 0;
  return `$${amount.toFixed(amount > 0 && amount < 0.01 ? 4 : 2)}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function formatTimeAgo(timestamp) {
  const value = new Date(timestamp).getTime();
  if (!Number.isFinite(value)) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** null when the previous window had no traffic — a jump from zero is not a percentage. */
function percentChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return undefined;
  return ((current - previous) / previous) * 100;
}

function sumPoints(points, key) {
  return points.reduce((total, point) => total + (Number(point[key]) || 0), 0);
}

async function fetchJson(path, signal) {
  const response = await fetch(path, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function isRequestOk(status) {
  const value = String(status ?? "").trim().toLowerCase();
  return value === "" || value === "ok" || value === "200" || value.includes("success");
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading dashboard">
      <div className="h-40 animate-pulse border border-border bg-surface-2" />
      <div className="h-32 animate-pulse border border-border bg-surface-2" />
      <div className="h-[320px] animate-pulse border border-border bg-surface-2" />
    </div>
  );
}

/** `▪ LABEL` chart legend marker — square chip for bars, rule for the cost line. */
function LegendChip({ color, label, line = false }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
      <span
        aria-hidden
        className={cn("shrink-0", line ? "h-0.5 w-3.5" : "size-2")}
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function CardHead({ title, children }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
      <h2 className="font-mono text-sm font-semibold text-text-main">{title}</h2>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  );
}

function EmptyState({ title, hint, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      <p className="font-mono text-sm font-medium text-text-main">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-text-muted">{hint}</p>
    </div>
  );
}

export default function DashboardHomeClient() {
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [priorTotals, setPriorTotals] = useState(null);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [balanceCents, setBalanceCents] = useState(0);

  const range = useMemo(() => findRange(period), [period]);

  const fetchDashboardData = useCallback(async (signal) => {
    const auth = await fetchJson("/api/auth/status", signal).catch(() => null);
    const admin = auth?.isAdminView === true;
    setIsAdmin(admin);
    const scope = admin ? "&scope=system" : "";
    const compare = findRange(period)?.compare;

    const results = await Promise.allSettled([
      fetchJson(`/api/usage/stats?period=${period}${scope}`, signal),
      fetchJson(`/api/usage/chart?period=${period}${scope}`, signal),
      fetchJson("/api/keys", signal),
      fetchJson("/api/account/wallet", signal),
      compare
        ? fetchJson(`/api/usage/chart?period=${compare.period}${scope}`, signal)
        : Promise.resolve(null),
    ]);

    if (signal?.aborted) return;

    const [statsResult, chartResult, keysResult, walletResult, compareResult] = results;
    if (statsResult.status === "fulfilled") setStats(statsResult.value);
    if (chartResult.status === "fulfilled") {
      setChartData(normalizeUsageChartPoints(chartResult.value));
    }
    if (keysResult.status === "fulfilled") {
      setKeys(Array.isArray(keysResult.value?.keys) ? keysResult.value.keys : []);
    }
    if (walletResult.status === "fulfilled") {
      setBalanceCents(walletResult.value?.balanceCents || 0);
    }

    // Previous window = the buckets immediately before the displayed ones.
    let prior = null;
    if (compare && compareResult.status === "fulfilled" && compareResult.value) {
      const points = normalizeUsageChartPoints(compareResult.value);
      const span = compare.buckets;
      if (points.length >= span * 2) {
        const window = points.slice(points.length - span * 2, points.length - span);
        prior = {
          requests: sumPoints(window, "requests"),
          tokens: sumPoints(window, "tokens"),
          cost: sumPoints(window, "cost"),
        };
      }
    }
    setPriorTotals(prior);

    const usageFailed = statsResult.status === "rejected" || chartResult.status === "rejected";
    setError(usageFailed ? "Your usage data could not be loaded. Try refreshing this page." : "");
    setLoading(false);
  }, [period]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchDashboardData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchDashboardData]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => fetchDashboardData(controller.signal), 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fetchDashboardData]);

  const promptTokens = Number(stats?.totalPromptTokens || 0);
  const completionTokens = Number(stats?.totalCompletionTokens || 0);
  const cachedTokens = Number(stats?.totalCachedTokens || 0);
  const totalTokens = promptTokens + completionTokens;
  const totalCost = Number(stats?.totalCost || 0);
  const cacheRate = promptTokens ? (cachedTokens / promptTokens) * 100 : 0;

  const inFlight = useMemo(
    () => (Array.isArray(stats?.activeRequests) ? stats.activeRequests : [])
      .reduce((total, entry) => total + (Number(entry.count) || 0), 0),
    [stats],
  );

  // Deltas compare like with like: both sides summed from chart buckets.
  const currentTotals = useMemo(() => ({
    requests: sumPoints(chartData, "requests"),
    tokens: sumPoints(chartData, "tokens"),
    cost: sumPoints(chartData, "cost"),
  }), [chartData]);

  const requestsDelta = percentChange(currentTotals.requests, priorTotals?.requests);
  const tokensDelta = percentChange(currentTotals.tokens, priorTotals?.tokens);
  const costDelta = percentChange(currentTotals.cost, priorTotals?.cost);

  const modelData = useMemo(() => {
    const entries = Object.values(stats?.byModel || {})
      .map((model) => ({
        name: model.rawModel || "Unknown model",
        value: Number(model.requests) || 0,
      }))
      .filter((model) => model.value > 0)
      .sort((a, b) => b.value - a.value);

    if (entries.length <= 4) return entries;
    const rest = entries.slice(4);
    return [
      ...entries.slice(0, 4),
      { name: "Other models", value: rest.reduce((sum, item) => sum + item.value, 0), isOther: true },
    ];
  }, [stats]);

  const modelTotal = modelData.reduce((sum, model) => sum + model.value, 0);

  const outcomeData = useMemo(
    () => Object.entries(STATUS_META)
      .map(([id, meta]) => ({
        id,
        name: meta.label,
        color: meta.color,
        value: Number(stats?.byStatus?.[id]) || 0,
      }))
      .filter((entry) => entry.value > 0),
    [stats],
  );
  const outcomeTotal = outcomeData.reduce((sum, entry) => sum + entry.value, 0);
  const successfulRequests = outcomeData.find((entry) => entry.id === "success")?.value || 0;
  const successRate = outcomeTotal ? (successfulRequests / outcomeTotal) * 100 : 0;

  const recentRequests = useMemo(() => {
    const rows = Array.isArray(stats?.recentRequests) ? stats.recentRequests : [];
    return rows.slice(0, 8);
  }, [stats]);

  const chartHasData = chartData.some((point) => Number(point.tokens) > 0);
  const primaryKey = keys.find((key) => key.isActive)?.key || keys[0]?.key || "";
  const spendNote = range.days
    ? `${formatCurrency(totalCost / range.days)}/day average`
    : range.costNote || "Across the selected window";

  if (loading && !stats) return <DashboardSkeleton />;

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-8">
      <QuickStartPanel apiKey={primaryKey} />

      <section className="min-w-0">
        <SectionLabel>Account Data</SectionLabel>
        <div className="tile-grid grid-cols-1 sm:grid-cols-2">
          <Card padding="md">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-surface-2">
                <Wallet aria-hidden size={16} strokeWidth={2.25} className="text-text-muted" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                  Current Balance
                </p>
                <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-tight text-text-main">
                  {formatCurrency(balanceCents / 100)}
                </p>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-surface-2">
                <ArrowRight aria-hidden size={16} strokeWidth={2.25} className="text-text-muted" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                  Consumption
                </p>
                <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-tight text-text-main">
                  {formatCurrency(totalCost)}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {error && (
        <div className="border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-text-main" role="status">
          {error}
        </div>
      )}

      <section className="min-w-0">
        <SectionLabel
          action={
            <div className="flex shrink-0 items-center gap-2">
              <PeriodDropdown value={period} onChange={setPeriod} disabled={refreshing} />
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex size-7 items-center justify-center border border-border bg-surface text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 disabled:cursor-wait disabled:opacity-60"
                aria-label="Refresh dashboard"
                title="Refresh dashboard"
              >
                <RefreshCw aria-hidden size={13} strokeWidth={2.25} className={refreshing ? "animate-spin" : ""} />
              </button>
            </div>
          }
        >
          Traffic — {isAdmin ? "Gateway wide" : "Your API keys"}
        </SectionLabel>

        <div className="tile-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            chip="requests"
            label="Requests"
            value={formatExact(stats?.totalRequests)}
            delta={requestsDelta}
            sub={inFlight ? `${inFlight} in flight` : "Nothing in flight"}
          />
          <StatTile
            chip="tokens"
            label="Tokens"
            value={formatNumber(totalTokens)}
            delta={tokensDelta}
            sub={`${formatNumber(promptTokens)} in · ${formatNumber(completionTokens)} out`}
          />
          <StatTile
            chip="tokens"
            label="Cache hit"
            value={formatPercent(cacheRate)}
            bar={{ value: cacheRate / 100 }}
            sub={`${formatNumber(cachedTokens)} of ${formatNumber(promptTokens)} input tokens`}
          />
          <StatTile
            chip="cost"
            label="Spend"
            value={formatCurrency(totalCost)}
            delta={costDelta}
            deltaTone="neutral"
            sub={spendNote}
          />
        </div>
      </section>

      <Card padding="none" className="min-w-0 overflow-hidden">
        <CardHead title="Tokens & spend">
          <div className="hidden items-center gap-3 sm:flex">
            <LegendChip color={COLOR_INPUT} label="Input" />
            <LegendChip color={COLOR_OUTPUT} label="Output" />
            <LegendChip color={COLOR_COST} label="Cost" line />
          </div>
          <Link
            href="/dashboard/usage"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted transition-colors hover:text-text-main"
          >
            Full usage
            <ArrowRight aria-hidden size={12} strokeWidth={2.5} />
          </Link>
        </CardHead>
        <div
          className="h-[300px] min-w-0 px-2 pb-3 pt-5 sm:px-4"
          role="img"
          aria-label="Input and output tokens with estimated cost over the selected period"
        >
          {chartHasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} {...CHART_GRID} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={CHART_TICK}
                  tickMargin={10}
                  minTickGap={16}
                />
                <YAxis
                  yAxisId="tokens"
                  tickLine={false}
                  axisLine={false}
                  tick={CHART_TICK}
                  tickFormatter={formatNumber}
                  width={54}
                />
                <YAxis yAxisId="cost" orientation="right" hide />
                <Tooltip
                  cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL}
                  formatter={(value, name) => [
                    name === "Cost" ? formatCurrency(value) : formatNumber(value),
                    name,
                  ]}
                />
                <Area
                  yAxisId="tokens"
                  type="monotone"
                  dataKey="promptTokens"
                  name="Input"
                  stackId="tokens"
                  stroke={COLOR_INPUT}
                  fill={COLOR_INPUT}
                  fillOpacity={0.28}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
                <Area
                  yAxisId="tokens"
                  type="monotone"
                  dataKey="completionTokens"
                  name="Output"
                  stackId="tokens"
                  stroke={COLOR_OUTPUT}
                  fill={COLOR_OUTPUT}
                  fillOpacity={0.28}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="cost"
                  type="monotone"
                  dataKey="cost"
                  name="Cost"
                  stroke={COLOR_COST}
                  strokeWidth={1.75}
                  dot={false}
                  activeDot={{ r: 3 }}
                  isAnimationActive={false}
                />
              </ComposedChart>

            </ResponsiveContainer>
          ) : (
            <EmptyState
              className="h-full"
              title="No traffic in this period"
              hint="Requests appear here as they pass through the gateway."
            />
          )}
        </div>
      </Card>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        <Card padding="none" className="min-w-0 overflow-hidden">
          <CardHead title="Live requests">
            {/* Request history lives on Usage for every role — Activity is a
                separate operations view, not the deeper cut of this table. */}
            <Link
              href="/dashboard/usage"
              className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted transition-colors hover:text-text-main"
            >
              History
              <ArrowRight aria-hidden size={12} strokeWidth={2.5} />
            </Link>
          </CardHead>
          {recentRequests.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left font-mono text-xs">
                <thead className="thead-data">
                  <tr>
                    <th className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em]">Model</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em]">Route</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em]">Tokens</th>
                    <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em]">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentRequests.map((request, index) => {
                    const ok = isRequestOk(request.status);
                    return (
                      <tr
                        key={`${request.timestamp}-${request.model}-${index}`}
                        className={cn("transition-colors hover:bg-surface-2/50", !ok && "bg-danger/[0.04]")}
                      >
                        <td className="max-w-[220px] px-5 py-3 text-text-main">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden
                              className={cn("size-1.5 shrink-0", ok ? "bg-success" : "bg-danger")}
                            />
                            <span className="truncate" title={request.model}>{request.model || "Unknown"}</span>
                            <span className="sr-only">{ok ? "Completed" : "Failed"}</span>
                          </span>
                        </td>
                        <td className={cn("max-w-[160px] truncate px-4 py-3", ok ? "text-text-muted" : "text-danger")}>
                          {request.provider || "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-text-main">
                          {formatNumber(Number(request.promptTokens || 0) + Number(request.completionTokens || 0))}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-text-muted">
                          {formatTimeAgo(request.timestamp)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No recent requests"
              hint="Send a request to your local endpoint to begin."
            />
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-5">
          <Card padding="none" className="min-w-0 overflow-hidden">
            <CardHead title="Model mix" />
            {modelData.length ? (
              <div className="flex flex-col gap-3.5 px-5 py-4">
                {modelData.map((model, index) => {
                  const share = modelTotal ? (model.value / modelTotal) * 100 : 0;
                  const color = model.isOther
                    ? "var(--color-text-subtle)"
                    : CHART_RAMP[index % CHART_RAMP.length];

                  return (
                    <div key={model.name} className="min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className={cn(
                            "min-w-0 truncate font-mono text-xs",
                            model.isOther ? "text-text-muted" : "text-text-main"
                          )}
                          title={model.name}
                        >
                          {model.name}
                        </span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">
                          {formatPercent(share)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full bg-surface-2">
                        <div
                          className="h-full"
                          style={{ width: `${Math.min(100, share)}%`, backgroundColor: color }}
                          aria-hidden
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No model activity yet"
                hint="Model distribution appears after the first request."
              />
            )}
          </Card>

          <Card padding="none" className="min-w-0 overflow-hidden">
            <CardHead title="Outcomes" />
            {outcomeTotal ? (
              <div className="px-5 py-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-text-main">
                    {formatPercent(successRate)}
                  </span>
                  <span className="min-w-0 truncate text-xs text-text-muted">
                    success over {formatExact(outcomeTotal)} requests
                  </span>
                </div>
                <div className="mt-3 flex h-2 w-full overflow-hidden bg-surface-2" aria-hidden>
                  {outcomeData.map((outcome) => (
                    <span
                      key={outcome.id}
                      className="h-full"
                      style={{
                        width: `${(outcome.value / outcomeTotal) * 100}%`,
                        backgroundColor: outcome.color,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2">
                  {outcomeData.map((outcome) => (
                    <div key={outcome.id} className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2 shrink-0"
                        style={{ backgroundColor: outcome.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs text-text-main">{outcome.name}</span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">
                        {formatExact(outcome.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                title="No outcomes recorded"
                hint="Success and failure counts appear after request details are stored."
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
