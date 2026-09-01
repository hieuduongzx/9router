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
import { ArrowRight, RefreshCw } from "lucide-react";

import { EmptyState, MiniRing, MiniSparkline, StatTile } from "@/shared/components";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Progress } from "@/shared/components/ui/progress";
import { PeriodDropdown } from "@/shared/components";
import { Icon } from "@/shared/components/ui/icon";

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
const COLOR_REQUESTS = CHART_COLORS.requests;
const COLOR_TOKENS = CHART_COLORS.tokens;

const STATUS_META = {
  success: { label: "Successful", color: CHART_COLORS.cost },
  error: { label: "Failed", color: CHART_COLORS.danger },
  rate_limited: { label: "Rate limited", color: CHART_COLORS.requests },
  other: { label: "Other", color: CHART_COLORS.info },
};

const DEFAULT_PERIOD = "24h";

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
      <div className="h-40 animate-pulse rounded-xl border bg-muted/40" />
      <div className="h-32 animate-pulse rounded-xl border bg-muted/40" />
      <div className="h-[320px] animate-pulse rounded-xl border bg-muted/40" />
    </div>
  );
}

function LegendChip({ color, label, line = false }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className={cn("shrink-0", line ? "h-0.5 w-3.5 rounded-sm" : "size-2 rounded-sm")}
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function CardSectionTitle({ title, action }) {
  return (
    <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
      <CardTitle className="text-base">{title}</CardTitle>
      {action ? <div className="flex shrink-0 items-center gap-3">{action}</div> : null}
    </CardHeader>
  );
}

export default function DashboardHomeClient() {
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [balanceCents, setBalanceCents] = useState(0);

  const fetchDashboardData = useCallback(async (signal) => {
    const auth = await fetchJson("/api/auth/status", signal).catch(() => null);
    const admin = auth?.isAdminView === true;
    setIsAdmin(admin);
    const scope = admin ? "&scope=system" : "";

    const results = await Promise.allSettled([
      fetchJson(`/api/usage/stats?period=${period}${scope}`, signal),
      fetchJson(`/api/usage/chart?period=${period}${scope}`, signal),
      fetchJson("/api/keys", signal),
      fetchJson("/api/account/wallet", signal),
    ]);

    if (signal?.aborted) return;

    const [statsResult, chartResult, keysResult, walletResult] = results;
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

    const usageFailed =
      statsResult.status === "rejected" ||
      chartResult.status === "rejected";
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

  // ----- Derived values -----
  const periodData = chartData;

  // Every usage value below follows the selected period. Balance is the only
  // account-level value that intentionally does not change with the filter.
  const filteredRequests = Number(stats?.totalRequests || 0);
  const filteredPromptTokens = Number(stats?.totalPromptTokens || 0);
  const filteredCompletionTokens = Number(stats?.totalCompletionTokens || 0);
  const filteredCachedTokens = Number(stats?.totalCachedTokens || 0);
  const filteredTokens = filteredPromptTokens + filteredCompletionTokens;
  const filteredCost = Number(stats?.totalCost || 0);
  const balance = balanceCents / 100;

  // `byModel` is keyed by model and provider; the headline counts each model once.
  const activeModels = useMemo(
    () => new Set(
      Object.values(stats?.byModel || {})
        .filter((model) => Number(model.requests) > 0)
        .map((model) => String(model.rawModel || "").trim())
        .filter(Boolean),
    ).size,
    [stats],
  );

  const cacheRate = filteredPromptTokens
    ? filteredCachedTokens / filteredPromptTokens
    : 0;

  // Sparkline points
  const costSpark = periodData.map((p) => p.cost);
  const requestsSpark = periodData.map((p) => p.requests);
  const tokensSpark = periodData.map((p) => p.tokens);
  const inputSpark = periodData.map((p) => p.promptTokens);
  const outputSpark = periodData.map((p) => p.completionTokens);

  // Outcome
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
  const successRate = outcomeTotal ? successfulRequests / outcomeTotal : 0;

  // Model mix
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

  // Recent requests
  const recentRequests = useMemo(() => {
    const rows = Array.isArray(stats?.recentRequests) ? stats.recentRequests : [];
    return rows.slice(0, 8);
  }, [stats]);

  // Tokens & spend chart
  const chartHasData = periodData.some((point) => Number(point.tokens) > 0);
  const primaryKey = keys.find((key) => key.isActive)?.key || keys[0]?.key || "";
  const periodLabel = USAGE_PERIODS.find((item) => item.value === period)?.label || period;

  if (loading && !stats) return <DashboardSkeleton />;

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-8">
      <QuickStartPanel apiKey={primaryKey} />

      {error ? (
        <div
          role="status"
          className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground"
        >
          {error}
        </div>
      ) : null}

      {/* Balance is fixed; all seven usage tiles follow the selected period. */}
      <section aria-labelledby="dashboard-stats">
        <h2 id="dashboard-stats" className="sr-only">Account and traffic overview</h2>
        <div className="tile-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            chip="info"
            label="Account balance"
            value={formatCurrency(balance)}
            meta="Available"
            chart={
              <MiniSparkline
                points={[balance, balance, balance]}
                color={COLOR_TOKENS}
                fill={COLOR_TOKENS}
                fillOpacity={0.15}
              />
            }
          />
          <StatTile
            chip="cost"
            label="Usage cost"
            value={formatCurrency(filteredCost)}
            meta={periodLabel}
            chart={
              <MiniSparkline
                points={costSpark}
                color={COLOR_COST}
                fill={COLOR_COST}
                fillOpacity={0.18}
              />
            }
          />
          <StatTile
            chip="requests"
            label="Request count"
            value={formatExact(filteredRequests)}
            meta={periodLabel}
            chart={
              <MiniSparkline
                points={requestsSpark}
                color={COLOR_REQUESTS}
                fill={COLOR_REQUESTS}
                fillOpacity={0.18}
              />
            }
          />
          <StatTile
            chip="tokens"
            label="Token usage"
            value={formatNumber(filteredTokens)}
            meta={periodLabel}
            chart={
              <MiniSparkline
                points={tokensSpark}
                color={COLOR_TOKENS}
                fill={COLOR_TOKENS}
                fillOpacity={0.18}
              />
            }
          />

          <StatTile
            chip="success"
            label="Success rate"
            value={formatPercent(successRate * 100)}
            meta={periodLabel}
            chart={<MiniRing value={successRate} color="var(--success)" />}
          />
          <StatTile
            chip="info"
            label="Active models"
            value={formatExact(activeModels)}
            meta={periodLabel}
            chart={
              <MiniSparkline
                points={requestsSpark}
                color={COLOR_INPUT}
                fill={COLOR_INPUT}
                fillOpacity={0.18}
              />
            }
          />
          <StatTile
            chip="cost"
            label="Input tokens"
            value={formatNumber(filteredPromptTokens)}
            meta={periodLabel}
            chart={
              <MiniSparkline
                points={inputSpark}
                color={COLOR_INPUT}
                fill={COLOR_INPUT}
                fillOpacity={0.18}
              />
            }
          />
          <StatTile
            chip="requests"
            label="Output tokens"
            value={formatNumber(filteredCompletionTokens)}
            meta={periodLabel}
            chart={
              <MiniSparkline
                points={outputSpark}
                color={COLOR_OUTPUT}
                fill={COLOR_OUTPUT}
                fillOpacity={0.18}
              />
            }
          />
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            All usage metrics reflect {periodLabel.toLowerCase()}; account balance is current.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <PeriodDropdown value={period} onChange={setPeriod} disabled={refreshing} />
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh dashboard"
              title="Refresh dashboard"
            >
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>
      </section>

      <Card padding="none" className="min-w-0 overflow-hidden">
        <CardSectionTitle
          title="Tokens & spend"
          action={
            <>
              <div className="hidden items-center gap-3 sm:flex">
                <LegendChip color={COLOR_INPUT} label="Input" />
                <LegendChip color={COLOR_OUTPUT} label="Output" />
                <LegendChip color={COLOR_COST} label="Cost" line />
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <Link href="/dashboard/usage">
                  Full usage
                  <ArrowRight />
                </Link>
              </Button>
            </>
          }
        />
        <div
          className="h-[300px] min-w-0 px-2 pb-3 pt-5 sm:px-4"
          role="img"
          aria-label="Input and output tokens with estimated cost over the selected period"
        >
          {chartHasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={periodData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
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
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
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
              description="Requests appear here as they pass through the gateway."
            />
          )}
        </div>
      </Card>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        <Card padding="none" className="min-w-0 overflow-hidden">
          <CardSectionTitle
            title="Live requests"
            action={
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <Link href="/dashboard/usage">
                  History
                  <ArrowRight />
                </Link>
              </Button>
            }
          />
          {recentRequests.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-5 py-2.5">Model</th>
                    <th className="px-4 py-2.5">Route</th>
                    <th className="px-4 py-2.5 text-right">Tokens</th>
                    <th className="px-5 py-2.5 text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.map((request, index) => {
                    const ok = isRequestOk(request.status);
                    return (
                      <tr
                        key={`${request.timestamp}-${request.model}-${index}`}
                        className={cn(
                          "border-b transition-colors last:border-b-0 hover:bg-muted/50",
                          !ok && "bg-destructive/[0.04]",
                        )}
                      >
                        <td className="max-w-[220px] px-5 py-3 text-foreground">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden
                              className={cn(
                                "size-1.5 shrink-0 rounded-sm",
                                ok ? "bg-success" : "bg-destructive",
                              )}
                            />
                            <span className="truncate" title={request.model}>
                              {request.model || "Unknown"}
                            </span>
                            <span className="sr-only">{ok ? "Completed" : "Failed"}</span>
                          </span>
                        </td>
                        <td
                          className={cn(
                            "max-w-[160px] truncate px-4 py-3",
                            ok ? "text-muted-foreground" : "text-destructive",
                          )}
                        >
                          {request.provider || "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">
                          {formatNumber(Number(request.promptTokens || 0) + Number(request.completionTokens || 0))}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-muted-foreground">
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
              description="Send a request to your local endpoint to begin."
            />
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-5">
          <Card padding="none" className="min-w-0 overflow-hidden">
            <CardSectionTitle title="Model mix" />
            {modelData.length ? (
              <div className="flex flex-col gap-3.5 px-5 py-4">
                {modelData.map((model, index) => {
                  const share = modelTotal ? (model.value / modelTotal) * 100 : 0;
                  const color = model.isOther
                    ? "var(--muted-foreground)"
                    : CHART_RAMP[index % CHART_RAMP.length];

                  return (
                    <div key={model.name} className="min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className={cn(
                            "min-w-0 truncate text-sm",
                            model.isOther ? "text-muted-foreground" : "text-foreground",
                          )}
                          title={model.name}
                        >
                          {model.name}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatPercent(share)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
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
                description="Model distribution appears after the first request."
              />
            )}
          </Card>

          <Card padding="none" className="min-w-0 overflow-hidden">
            <CardSectionTitle title="Outcomes" />
            {outcomeTotal ? (
              <div className="px-5 py-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums tracking-tight">
                    {formatPercent(successRate * 100)}
                  </span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    success over {formatExact(outcomeTotal)} requests
                  </span>
                </div>
                <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
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
                        className="size-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: outcome.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                        {outcome.name}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatExact(outcome.value)}
                      </span>
                    </div>
                  ))}
                </div>
                <Progress
                  className="mt-3 h-1"
                  value={successRate * 100}
                  indicatorClassName="bg-success"
                />
              </div>
            ) : (
              <EmptyState
                title="No outcomes recorded"
                description="Success and failure counts appear after request details are stored."
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
