"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/shared/components/Card";
import PeriodDropdown from "@/shared/components/PeriodDropdown";
import { normalizeUsageChartPoints } from "@/shared/utils/usageChart";
import EndpointPageClient from "./endpoint/EndpointPageClient";

const STATUS_META = {
  success: { label: "Successful", color: "#16A34A" },
  error: { label: "Failed", color: "#DC2626" },
  rate_limited: { label: "Rate limited", color: "#F59E0B" },
  other: { label: "Other", color: "#2563EB" },
};
const MODEL_COLORS = ["#7C3AED", "#16A34A", "#F59E0B", "#2563EB", "#DC2626"];

const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatNumber(value) {
  return compactNumber.format(Number(value) || 0);
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
  if (!Number.isFinite(value)) return "Unknown time";
  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}


async function fetchJson(path, signal) {
  const response = await fetch(path, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

const METRIC_CHIPS = {
  coral: "bg-[var(--color-chip-requests)]",
  blue: "bg-[var(--color-chip-tokens)]",
  green: "bg-[var(--color-chip-cost)]",
  amber: "bg-[var(--color-chip-info)]",
};

function Metric({ label, value, detail, tone }) {
  return (
    <div className="min-w-0 px-5 py-5 sm:px-6">
      <div className="mb-2.5 flex items-center gap-2">
        <span className={`size-2 shrink-0 ${METRIC_CHIPS[tone]}`} aria-hidden="true" />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</span>
      </div>
      <p className="truncate font-mono text-2xl font-semibold tabular-nums tracking-tight text-text-main sm:text-[28px]">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-text-subtle">{detail}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading dashboard">
      <div className="h-16 animate-pulse bg-surface-2" />
      <div className="h-32 animate-pulse bg-surface-2" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(280px,0.75fr)]">
        <div className="h-[350px] animate-pulse bg-surface-2" />
        <div className="h-[350px] animate-pulse bg-surface-2" />
      </div>
    </div>
  );
}

export default function DashboardHomeClient() {
  const [period, setPeriod] = useState("7d");
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchDashboardData = useCallback(async (signal) => {
    const auth = await fetchJson("/api/auth/status", signal).catch(() => null);
    const admin = auth?.isAdminView === true;
    setIsAdmin(admin);
    const scope = admin ? "&scope=system" : "";
    const chartRequest = fetchJson(`/api/usage/chart?period=${period}${scope}`, signal);
    const hourlyRequest = period === "today"
      ? chartRequest
      : Promise.resolve({ points: [] });
    const results = await Promise.allSettled([
      fetchJson(`/api/usage/stats?period=${period}${scope}`, signal),
      chartRequest,
      hourlyRequest,
      fetchJson("/api/keys", signal),
    ]);

    if (signal?.aborted) return;

    const [statsResult, chartResult, hourlyResult, keysResult] = results;
    if (statsResult.status === "fulfilled") setStats(statsResult.value);
    if (chartResult.status === "fulfilled") {
      setChartData(normalizeUsageChartPoints(chartResult.value));
    }
    if (hourlyResult.status === "fulfilled") {
      setHourlyData(normalizeUsageChartPoints(hourlyResult.value));
    }
    if (keysResult.status === "fulfilled") {
      setKeys(Array.isArray(keysResult.value?.keys) ? keysResult.value.keys : []);
    }

    const usageFailed = statsResult.status === "rejected" || chartResult.status === "rejected" || hourlyResult.status === "rejected";
    setError(usageFailed ? "Your usage data could not be loaded. Try refreshing this page." : "");
    setLastUpdated(new Date());
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

  const cacheRate = stats?.totalPromptTokens
    ? (Number(stats.totalCachedTokens || 0) / Number(stats.totalPromptTokens)) * 100
    : 0;


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
      { name: "Other models", value: rest.reduce((sum, item) => sum + item.value, 0) },
    ];
  }, [stats]);

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

  const recentRequests = Array.isArray(stats?.recentRequests) ? stats.recentRequests.slice(0, 6) : [];
  const chartHasData = chartData.some((point) => Number(point.tokens) > 0);
  const costHasData = chartData.some((point) => Number(point.cost) > 0);
  const hourlyHasData = hourlyData.some((point) => Number(point.tokens) > 0);
  const activeKeys = keys.filter((key) => key.isActive).length;

  if (loading && !stats) return <DashboardSkeleton />;

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-mono text-xl font-semibold tracking-tight text-text-main">{"// "}Dashboard overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            {isAdmin ? "Gateway-wide model traffic, token volume, and estimated cost." : "Your model traffic, token volume, and estimated cost."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodDropdown value={period} onChange={setPeriod} />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex size-9 items-center justify-center rounded-sm border border-border bg-surface text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 disabled:cursor-wait disabled:opacity-60"
            aria-label="Refresh dashboard"
            title="Refresh dashboard"
          >
            <span className={`material-symbols-outlined text-[18px] ${refreshing ? "animate-spin" : ""}`}>refresh</span>
          </button>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-text-main" role="status">
          <span className="material-symbols-outlined mt-0.5 text-[18px] text-warning">warning</span>
          <p className="flex-1">{error}</p>
        </div>
      )}


      {isAdmin && <EndpointPageClient />}

      <div className="tile-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Requests"
          value={formatNumber(stats?.totalRequests)}
          detail={`${stats?.activeRequests?.length || 0} active now`}
          tone="coral"
        />
        <Metric
          label="Total tokens"
          value={formatNumber(Number(stats?.totalPromptTokens || 0) + Number(stats?.totalCompletionTokens || 0))}
          detail={`${formatNumber(stats?.totalCompletionTokens)} generated`}
          tone="blue"
        />
        <Metric
          label="Cache utilization"
          value={formatPercent(cacheRate)}
          detail={`${formatNumber(stats?.totalCachedTokens)} cached tokens`}
          tone="green"
        />
        <Metric
          label="Estimated cost"
          value={formatCurrency(stats?.totalCost)}
          detail={lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Awaiting data"}
          tone="amber"
        />
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
            <div>
              <h2 className="font-mono text-sm font-semibold text-text-main">Token traffic</h2>
              <p className="mt-0.5 text-xs text-text-muted">Prompt and completion volume over the selected period</p>
            </div>
            <Link href="/dashboard/usage" className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">
              Full usage
            </Link>
          </div>
          <div className="h-[286px] min-w-0 px-2 pb-3 pt-5 sm:px-4" role="img" aria-label="Input and output token traffic stacked bar chart">
            {chartHasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }} barCategoryGap="24%">
                  <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.65} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} tickMargin={10} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} tickFormatter={formatNumber} width={54} />
                  <Tooltip
                    cursor={{ fill: "var(--color-surface-2)", opacity: 0.7 }}
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 0,
                      color: "var(--color-text-main)",
                      fontSize: 12,
                    }}
                    formatter={(value, name) => [formatNumber(value), name]}
                  />
                  <Bar
                    dataKey="promptTokens"
                    name="Input tokens"
                    stackId="tokens"
                    fill="#7C3AED"
                    maxBarSize={32}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="completionTokens"
                    name="Output tokens"
                    stackId="tokens"
                    fill="#2563EB"
                    maxBarSize={32}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-3xl text-text-subtle">monitoring</span>
                <p className="mt-2 text-sm font-medium text-text-main">No traffic in this period</p>
                <p className="mt-1 text-xs text-text-muted">Requests will appear here as they pass through Router2k.</p>
              </div>
            )}
          </div>
        </Card>

        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
            <div>
              <h2 className="font-mono text-sm font-semibold text-text-main">Spend over time</h2>
              <p className="mt-0.5 text-xs text-text-muted">Estimated model cost across the selected period</p>
            </div>
            <span className="shrink-0 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-warning">
              {formatCurrency(stats?.totalCost)}
            </span>
          </div>
          <div className="h-[286px] min-w-0 px-2 pb-3 pt-5 sm:px-4" role="img" aria-label="Estimated spend bar chart">
            {costHasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: -2, bottom: 0 }} barCategoryGap="24%">
                  <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.65} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} tickMargin={10} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} tickFormatter={formatCurrency} width={60} />
                  <Tooltip
                    cursor={{ fill: "var(--color-surface-2)", opacity: 0.7 }}
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 0,
                      color: "var(--color-text-main)",
                      fontSize: 12,
                    }}
                    formatter={(value) => [formatCurrency(value), "Estimated cost"]}
                  />
                  <Bar
                    dataKey="cost"
                    fill="#16A34A"
                    maxBarSize={32}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <span className="material-symbols-outlined text-3xl text-text-subtle">payments</span>
                <p className="mt-2 text-sm font-medium text-text-main">No priced usage in this period</p>
                <p className="mt-1 text-xs text-text-muted">Requests without configured model rates do not add estimated cost.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="border-b border-border-subtle px-5 py-4">
            <h2 className="font-mono text-sm font-semibold text-text-main">Model mix</h2>
            <p className="mt-0.5 text-xs text-text-muted">Share of requests by model</p>
          </div>
          {modelData.length ? (
            <div className="grid min-h-[280px] items-center gap-4 px-5 py-5 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]">
              <div className="relative mx-auto h-40 w-full max-w-[220px]" role="img" aria-label="Model request share donut chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={modelData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={68} paddingAngle={modelData.length > 1 ? 3 : 0} stroke="none" isAnimationActive={false}>
                      {modelData.map((entry, index) => (
                        <Cell key={entry.name} fill={MODEL_COLORS[index % MODEL_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 0,
                        color: "var(--color-text-main)",
                        fontSize: 12,
                      }}
                      formatter={(value) => [`${formatNumber(value)} requests`, "Usage"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-semibold tabular-nums text-text-main">{formatNumber(stats?.totalRequests)}</span>
                  <span className="text-[10px] text-text-muted">requests</span>
                </div>
              </div>
              <div className="space-y-2.5">
                {modelData.map((model, index) => (
                  <div key={model.name} className="flex min-w-0 items-center gap-2 text-xs">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length] }} />
                    <span className="min-w-0 flex-1 truncate text-text-main" title={model.name}>{model.name}</span>
                    <span className="shrink-0 tabular-nums text-text-muted">{formatPercent((model.value / Math.max(1, stats?.totalRequests || 0)) * 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
              <span className="material-symbols-outlined text-3xl text-text-subtle">donut_large</span>
              <p className="mt-2 text-sm font-medium text-text-main">No model activity yet</p>
              <p className="mt-1 text-xs text-text-muted">Model distribution appears after the first request.</p>
            </div>
          )}
        </Card>

        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="border-b border-border-subtle px-5 py-4">
            <h2 className="font-mono text-sm font-semibold text-text-main">Request outcomes</h2>
            <p className="mt-0.5 text-xs text-text-muted">Completion health across recorded request details</p>
          </div>
          {outcomeData.length ? (
            <div className="grid min-h-[280px] items-center gap-4 px-5 py-5 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]">
              <div className="relative mx-auto h-40 w-full max-w-[220px]" role="img" aria-label="Request outcome donut chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={outcomeData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={68} paddingAngle={outcomeData.length > 1 ? 3 : 0} stroke="none" isAnimationActive={false}>
                      {outcomeData.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 0,
                        color: "var(--color-text-main)",
                        fontSize: 12,
                      }}
                      formatter={(value) => [`${formatNumber(value)} requests`, "Outcome"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-semibold tabular-nums text-text-main">{formatPercent(successRate)}</span>
                  <span className="text-[10px] text-text-muted">successful</span>
                </div>
              </div>
              <div className="space-y-2.5">
                {outcomeData.map((outcome) => (
                  <div key={outcome.id} className="flex min-w-0 items-center gap-2 text-xs">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: outcome.color }} />
                    <span className="min-w-0 flex-1 truncate text-text-main">{outcome.name}</span>
                    <span className="shrink-0 tabular-nums text-text-muted">
                      {formatNumber(outcome.value)} · {formatPercent((outcome.value / outcomeTotal) * 100)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
              <span className="material-symbols-outlined text-3xl text-text-subtle">task_alt</span>
              <p className="mt-2 text-sm font-medium text-text-main">No outcomes recorded</p>
              <p className="mt-1 text-xs text-text-muted">Success and failure distribution appears after request details are stored.</p>
            </div>
          )}
        </Card>
      </div>

      {period === "today" && (
      <Card padding="none" className="min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
          <div>
            <h2 className="font-mono text-sm font-semibold text-text-main">Today by hour</h2>
            <p className="mt-0.5 text-xs text-text-muted">Token traffic across the current day</p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${hourlyHasData ? "bg-success/10 text-success" : "bg-surface-2 text-text-muted"}`}>
            {hourlyHasData ? "Live activity" : "No traffic today"}
          </span>
        </div>
        <div className="h-[240px] min-w-0 px-2 pb-3 pt-5 sm:px-4" role="img" aria-label="Hourly token traffic bar chart">
          {hourlyData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.65} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={2}
                  tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                  tickMargin={9}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                  tickFormatter={formatNumber}
                  width={54}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-surface-2)", opacity: 0.65 }}
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 0,
                    boxShadow: "none",
                    color: "var(--color-text-main)",
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                  }}
                  formatter={(value) => [formatNumber(value), "Tokens"]}
                />
                <Bar dataKey="tokens" fill="#4F7CAC" radius={[0, 0, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-muted">Hourly data is unavailable.</div>
          )}
        </div>
      </Card>
      )}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
            <div>
              <h2 className="font-mono text-sm font-semibold text-text-main">Recent requests</h2>
              <p className="mt-0.5 text-xs text-text-muted">{isAdmin ? "Latest model traffic across the gateway" : "Latest model traffic for your API keys"}</p>
            </div>
            <Link href={isAdmin ? "/dashboard/activity?tab=requests" : "/dashboard/usage?tab=details"} className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">
              {isAdmin ? "View operations" : "View history"}
            </Link>
          </div>
          {recentRequests.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left font-mono text-xs">
                <thead className="border-b border-border text-text-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold uppercase tracking-wide">Model</th>
                    <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wide">Tokens</th>
                    <th className="px-4 py-2.5 font-semibold uppercase tracking-wide">Status</th>
                    <th className="px-5 py-2.5 text-right font-semibold uppercase tracking-wide">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentRequests.map((request, index) => {
                    const successful = request.status === "ok" || request.status === "success";
                    return (
                      <tr key={`${request.timestamp}-${request.model}-${index}`} className="transition-colors hover:bg-surface-2/50">
                        <td className="max-w-[190px] truncate px-5 py-3 font-medium text-text-main" title={request.model}>{request.model || "Unknown"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-text-main">{formatNumber(Number(request.promptTokens || 0) + Number(request.completionTokens || 0))}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 font-medium uppercase ${successful ? "text-success" : "text-danger"}`}>
                            <span className={`size-1.5 rounded-full ${successful ? "bg-success" : "bg-danger"}`} />
                            {successful ? "Completed" : "Failed"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right text-text-muted">{formatTimeAgo(request.timestamp)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
              <span className="material-symbols-outlined text-3xl text-text-subtle">receipt_long</span>
              <p className="mt-2 text-sm font-medium text-text-main">No recent requests</p>
              <p className="mt-1 text-xs text-text-muted">Send a request to your local endpoint to begin.</p>
            </div>
          )}
        </Card>

        {isAdmin ? (
          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="font-mono text-sm font-semibold text-text-main">Admin workspace</h2>
              <p className="mt-0.5 text-xs text-text-muted">Operational and account management shortcuts</p>
            </div>
            <div className="divide-y divide-border-subtle">
              <Link href="/dashboard/activity" className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-bg-alt">
                <span className="flex size-8 items-center justify-center border border-border bg-surface-2 text-text-main">
                  <span className="material-symbols-outlined text-[18px]">monitoring</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-text-main">Operations activity</span>
                  <span className="mt-0.5 block text-[10px] text-text-muted">System, routing, and request diagnostics</span>
                </span>
                <span className="material-symbols-outlined text-[16px] text-text-subtle">chevron_right</span>
              </Link>
              <Link href="/dashboard/users" className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-bg-alt">
                <span className="flex size-8 items-center justify-center border border-border bg-surface-2 text-text-main">
                  <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-text-main">Accounts</span>
                  <span className="mt-0.5 block text-[10px] text-text-muted">Users, access, and credit controls</span>
                </span>
                <span className="material-symbols-outlined text-[16px] text-text-subtle">chevron_right</span>
              </Link>
              <Link href="/dashboard/settings" className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-bg-alt">
                <span className="flex size-8 items-center justify-center border border-border bg-surface-2 text-text-main">
                  <span className="material-symbols-outlined text-[18px]">settings</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-text-main">Gateway settings</span>
                  <span className="mt-0.5 block text-[10px] text-text-muted">Runtime, security, and pricing</span>
                </span>
                <span className="material-symbols-outlined text-[16px] text-text-subtle">chevron_right</span>
              </Link>
            </div>
            <div className="grid grid-cols-2 border-t border-border-subtle bg-bg-alt/60">
              <div className="border-r border-border-subtle px-5 py-4">
                <p className="text-[10px] font-medium text-text-muted">API keys</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-text-main">{activeKeys} active</p>
              </div>
              <div className="min-w-0 px-5 py-4">
                <p className="text-[10px] font-medium text-text-muted">Endpoint mode</p>
                <p className="mt-1 truncate text-sm font-semibold text-text-main">Self-hosted</p>
              </div>
            </div>
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="font-mono text-sm font-semibold text-text-main">Your access</h2>
              <p className="mt-0.5 text-xs text-text-muted">Account-owned resources</p>
            </div>
            <div className="divide-y divide-border-subtle">
              <Link href="/dashboard/api-keys" className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-bg-alt">
                <span className="flex size-8 items-center justify-center border border-border bg-surface-2 text-text-main">
                  <span className="material-symbols-outlined text-[18px]">vpn_key</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-text-main">API keys</span>
                  <span className="mt-0.5 block text-[10px] text-text-muted">{activeKeys} active for this account</span>
                </span>
                <span className="material-symbols-outlined text-[16px] text-text-subtle">chevron_right</span>
              </Link>
              <Link href="/dashboard/models" className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-bg-alt">
                <span className="flex size-8 items-center justify-center border border-border bg-surface-2 text-text-main">
                  <span className="material-symbols-outlined text-[18px]">deployed_code</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-text-main">Available models</span>
                  <span className="mt-0.5 block text-[10px] text-text-muted">Copy routed model IDs</span>
                </span>
                <span className="material-symbols-outlined text-[16px] text-text-subtle">chevron_right</span>
              </Link>
              <Link href="/dashboard/account" className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-bg-alt">
                <span className="flex size-8 items-center justify-center border border-border bg-surface-2 text-text-main">
                  <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-text-main">Account security</span>
                  <span className="mt-0.5 block text-[10px] text-text-muted">Identity and password</span>
                </span>
                <span className="material-symbols-outlined text-[16px] text-text-subtle">chevron_right</span>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
