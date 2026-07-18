"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import {
  Area,
  AreaChart,
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
import EndpointPageClient from "./endpoint/EndpointPageClient";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "60d", label: "60 days" },
  { value: "all", label: "All" },
];

const MODEL_COLORS = ["#E56A4A", "#4F7CAC", "#2F9E8F", "#D99A32", "#8B6BB1"];

const METRIC_ICONS = {
  requests: (
    <>
      <path d="M4 8h13m0 0-3-3m3 3-3 3" />
      <path d="M20 16H7m0 0 3 3m-3-3 3-3" />
    </>
  ),
  tokens: (
    <>
      <path d="M8 4H6a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2h-2" />
    </>
  ),
  cache: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M6.1 8.2A7 7 0 0 1 18.8 7L20 12" />
      <path d="M17.9 15.8A7 7 0 0 1 5.2 17L4 12" />
    </>
  ),
  cost: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M7 9h.01M17 15h.01" />
    </>
  ),
};

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

function providerName(connection) {
  return (
    connection?.providerSpecificData?.nodeName ||
    connection?.displayName ||
    connection?.name ||
    connection?.provider ||
    "Provider"
  );
}

function statusMeta(connection) {
  if (!connection?.isActive) {
    return { label: "Paused", dot: "bg-text-subtle", text: "text-text-muted" };
  }
  if (connection.testStatus === "active") {
    return { label: "Healthy", dot: "bg-success", text: "text-success" };
  }
  if (connection.testStatus === "unavailable") {
    return { label: "Needs attention", dot: "bg-danger", text: "text-danger" };
  }
  return { label: "Not checked", dot: "bg-warning", text: "text-warning" };
}

async function fetchJson(path, signal) {
  const response = await fetch(path, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function Metric({ icon, label, value, detail, tone }) {
  const tones = {
    coral: "bg-brand-500/10 text-brand-600 dark:text-brand-300",
    blue: "bg-info/10 text-info",
    green: "bg-success/10 text-success",
    amber: "bg-warning/10 text-warning",
  };

  return (
    <div className="flex min-w-0 gap-3 px-4 py-4 sm:px-5 lg:px-6">
      <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] ${tones[tone]}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-[19px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {METRIC_ICONS[icon]}
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        <p className="mt-1 truncate text-2xl font-semibold tabular-nums tracking-[-0.025em] text-text-main">
          {value}
        </p>
        <p className="mt-0.5 truncate text-xs text-text-subtle">{detail}</p>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading dashboard">
      <div className="h-16 animate-pulse rounded-[14px] bg-surface-2" />
      <div className="h-32 animate-pulse rounded-[14px] bg-surface-2" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(280px,0.75fr)]">
        <div className="h-[350px] animate-pulse rounded-[14px] bg-surface-2" />
        <div className="h-[350px] animate-pulse rounded-[14px] bg-surface-2" />
      </div>
    </div>
  );
}

export default function DashboardHomeClient({ machineId }) {
  const [period, setPeriod] = useState("7d");
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [connections, setConnections] = useState([]);
  const [keys, setKeys] = useState([]);
  const [tunnelStatus, setTunnelStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchDashboardData = useCallback(async (signal) => {
    const chartRequest = fetchJson(`/api/usage/chart?period=${period}`, signal);
    const hourlyRequest = period === "today"
      ? chartRequest
      : fetchJson("/api/usage/chart?period=today", signal);
    const results = await Promise.allSettled([
      fetchJson(`/api/usage/stats?period=${period}`, signal),
      chartRequest,
      hourlyRequest,
      fetchJson("/api/providers", signal),
      fetchJson("/api/keys", signal),
      fetchJson("/api/tunnel/status", signal),
    ]);

    if (signal?.aborted) return;

    const [statsResult, chartResult, hourlyResult, providersResult, keysResult, tunnelResult] = results;
    if (statsResult.status === "fulfilled") setStats(statsResult.value);
    if (chartResult.status === "fulfilled") {
      setChartData(Array.isArray(chartResult.value) ? chartResult.value : []);
    }
    if (hourlyResult.status === "fulfilled") {
      setHourlyData(Array.isArray(hourlyResult.value) ? hourlyResult.value : []);
    }
    if (providersResult.status === "fulfilled") {
      setConnections(Array.isArray(providersResult.value?.connections) ? providersResult.value.connections : []);
    }
    if (keysResult.status === "fulfilled") {
      setKeys(Array.isArray(keysResult.value?.keys) ? keysResult.value.keys : []);
    }
    if (tunnelResult.status === "fulfilled") setTunnelStatus(tunnelResult.value);

    const usageFailed = statsResult.status === "rejected" || chartResult.status === "rejected" || hourlyResult.status === "rejected";
    setError(usageFailed ? "Usage data could not be loaded. Provider and endpoint status may still be available." : "");
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

  const providerSummary = useMemo(() => {
    const enabled = connections.filter((connection) => connection.isActive);
    return {
      enabled: enabled.length,
      healthy: enabled.filter((connection) => connection.testStatus === "active").length,
      issues: enabled.filter((connection) => connection.testStatus === "unavailable").length,
    };
  }, [connections]);

  const visibleProviders = useMemo(() => {
    const rank = (connection) => {
      if (connection.isActive && connection.testStatus === "unavailable") return 0;
      if (connection.isActive && connection.testStatus !== "active") return 1;
      if (connection.isActive) return 2;
      return 3;
    };
    return [...connections].sort((a, b) => rank(a) - rank(b)).slice(0, 5);
  }, [connections]);

  const modelData = useMemo(() => {
    const entries = Object.values(stats?.byModel || {})
      .map((model) => ({
        name: model.rawModel || "Unknown model",
        provider: model.provider || "Unknown provider",
        value: Number(model.requests) || 0,
      }))
      .filter((model) => model.value > 0)
      .sort((a, b) => b.value - a.value);

    if (entries.length <= 4) return entries;
    const rest = entries.slice(4);
    return [
      ...entries.slice(0, 4),
      { name: "Other models", provider: `${rest.length} models`, value: rest.reduce((sum, item) => sum + item.value, 0) },
    ];
  }, [stats]);

  const recentRequests = Array.isArray(stats?.recentRequests) ? stats.recentRequests.slice(0, 6) : [];
  const chartHasData = chartData.some((point) => Number(point.tokens) > 0);
  const hourlyHasData = hourlyData.some((point) => Number(point.tokens) > 0);
  const activeKeys = keys.filter((key) => key.isActive).length;
  const publicEndpoint = tunnelStatus?.tunnel?.running
    ? tunnelStatus.tunnel.tunnelUrl || tunnelStatus.tunnel.publicUrl
    : tunnelStatus?.tailscale?.running
      ? tunnelStatus.tailscale.tunnelUrl
      : "Not enabled";

  if (loading && !stats) return <DashboardSkeleton />;

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-text-main">Operations overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Traffic, cost, and provider health across your 9Router gateway.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex max-w-full overflow-x-auto rounded-[10px] border border-border bg-surface p-1 shadow-[var(--shadow-soft)]" aria-label="Dashboard period">
            {PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPeriod(item.value)}
                aria-pressed={period === item.value}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                  period === item.value
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex size-9 items-center justify-center rounded-[10px] border border-border bg-surface text-text-muted shadow-[var(--shadow-soft)] transition-colors hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-wait disabled:opacity-60"
            aria-label="Refresh dashboard"
            title="Refresh dashboard"
          >
            <span className={`material-symbols-outlined text-[18px] ${refreshing ? "animate-spin" : ""}`}>refresh</span>
          </button>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-[12px] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-text-main" role="status">
          <span className="material-symbols-outlined mt-0.5 text-[18px] text-warning">warning</span>
          <p className="flex-1">{error}</p>
        </div>
      )}


      <EndpointPageClient machineId={machineId} />

      <Card padding="none" className="overflow-hidden">
        <div className="grid divide-y divide-border-subtle sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <Metric
            icon="requests"
            label="Requests"
            value={formatNumber(stats?.totalRequests)}
            detail={`${stats?.activeRequests?.length || 0} active now`}
            tone="coral"
          />
          <Metric
            icon="tokens"
            label="Total tokens"
            value={formatNumber(Number(stats?.totalPromptTokens || 0) + Number(stats?.totalCompletionTokens || 0))}
            detail={`${formatNumber(stats?.totalCompletionTokens)} generated`}
            tone="blue"
          />
          <Metric
            icon="cache"
            label="Cache utilization"
            value={formatPercent(cacheRate)}
            detail={`${formatNumber(stats?.totalCachedTokens)} cached tokens`}
            tone="green"
          />
          <Metric
            icon="cost"
            label="Estimated cost"
            value={formatCurrency(stats?.totalCost)}
            detail={lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Awaiting data"}
            tone="amber"
          />
        </div>
      </Card>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-text-main">Token traffic</h2>
              <p className="mt-0.5 text-xs text-text-muted">Prompt and completion volume over the selected period</p>
            </div>
            <Link href="/dashboard/usage" className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">
              Full usage
            </Link>
          </div>
          <div className="h-[286px] min-w-0 px-2 pb-3 pt-5 sm:px-4" role="img" aria-label="Token traffic area chart">
            {chartHasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="homeTokenFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E56A4A" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#E56A4A" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.65} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} tickMargin={10} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} tickFormatter={formatNumber} width={54} />
                  <Tooltip
                    cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 10,
                      boxShadow: "var(--shadow-elevated)",
                      color: "var(--color-text-main)",
                      fontSize: 12,
                    }}
                    formatter={(value) => [formatNumber(value), "Tokens"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stroke="#E56A4A"
                    strokeWidth={2.5}
                    fill="url(#homeTokenFill)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, fill: "#E56A4A", stroke: "var(--color-surface)" }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-3xl text-text-subtle">monitoring</span>
                <p className="mt-2 text-sm font-medium text-text-main">No traffic in this period</p>
                <p className="mt-1 text-xs text-text-muted">Requests will appear here as they pass through 9Router.</p>
              </div>
            )}
          </div>
        </Card>

        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="border-b border-border-subtle px-5 py-4">
            <h2 className="text-sm font-semibold text-text-main">Model mix</h2>
            <p className="mt-0.5 text-xs text-text-muted">Share of requests by model</p>
          </div>
          {modelData.length ? (
            <div className="px-5 pb-5 pt-4">
              <div className="relative mx-auto h-40 max-w-[220px]" role="img" aria-label="Model request share donut chart">
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
                        borderRadius: 10,
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
              <div className="mt-2 space-y-2.5">
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
      </div>

      <Card padding="none" className="min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-text-main">Today by hour</h2>
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
                    borderRadius: 10,
                    boxShadow: "var(--shadow-elevated)",
                    color: "var(--color-text-main)",
                    fontSize: 12,
                  }}
                  formatter={(value) => [formatNumber(value), "Tokens"]}
                />
                <Bar dataKey="tokens" fill="#4F7CAC" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-muted">Hourly data is unavailable.</div>
          )}
        </div>
      </Card>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-text-main">Recent requests</h2>
              <p className="mt-0.5 text-xs text-text-muted">Latest traffic across all API keys</p>
            </div>
            <Link href="/dashboard/usage?tab=logs" className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">
              View logs
            </Link>
          </div>
          {recentRequests.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead className="bg-bg-alt text-text-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Model</th>
                    <th className="px-4 py-2.5 font-medium">Provider</th>
                    <th className="px-4 py-2.5 text-right font-medium">Tokens</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5 text-right font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {recentRequests.map((request, index) => {
                    const connection = connections.find((item) => item.provider === request.provider);
                    const successful = request.status === "ok" || request.status === "success";
                    return (
                      <tr key={`${request.timestamp}-${request.model}-${index}`} className="transition-colors hover:bg-bg-alt/70">
                        <td className="max-w-[190px] truncate px-5 py-3 font-medium text-text-main" title={request.model}>{request.model || "Unknown"}</td>
                        <td className="max-w-[150px] truncate px-4 py-3 text-text-muted" title={providerName(connection)}>{providerName(connection)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-text-main">{formatNumber(Number(request.promptTokens || 0) + Number(request.completionTokens || 0))}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 font-medium ${successful ? "text-success" : "text-danger"}`}>
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

        <Card padding="none" className="overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-text-main">Infrastructure</h2>
              <p className="mt-0.5 text-xs text-text-muted">Provider and access health</p>
            </div>
            {providerSummary.issues > 0 ? (
              <span className="rounded-full bg-danger/10 px-2 py-1 text-[10px] font-semibold text-danger">{providerSummary.issues} issue{providerSummary.issues === 1 ? "" : "s"}</span>
            ) : (
              <span className="rounded-full bg-success/10 px-2 py-1 text-[10px] font-semibold text-success">All healthy</span>
            )}
          </div>
          <div className="divide-y divide-border-subtle">
            {visibleProviders.map((connection) => {
              const status = statusMeta(connection);
              return (
                <Link key={connection.id} href={`/dashboard/providers/${connection.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-bg-alt">
                  <span className={`size-2 shrink-0 rounded-full ${status.dot}`} />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-main">{providerName(connection)}</span>
                  <span className={`shrink-0 text-[10px] font-medium ${status.text}`}>{status.label}</span>
                  <span className="material-symbols-outlined text-[16px] text-text-subtle">chevron_right</span>
                </Link>
              );
            })}
            {!visibleProviders.length && (
              <div className="px-5 py-6 text-center text-xs text-text-muted">No providers configured.</div>
            )}
          </div>
          <div className="grid grid-cols-2 border-t border-border-subtle bg-bg-alt/60">
            <div className="border-r border-border-subtle px-5 py-4">
              <p className="text-[10px] font-medium text-text-muted">API keys</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-text-main">{activeKeys} active</p>
            </div>
            <div className="min-w-0 px-5 py-4">
              <p className="text-[10px] font-medium text-text-muted">Public endpoint</p>
              <p className="mt-1 truncate text-sm font-semibold text-text-main" title={publicEndpoint}>{publicEndpoint}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-5 py-3">
            <Link href="/dashboard/providers" className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">Manage providers</Link>
            <Link href="/dashboard/api-keys" className="text-xs font-medium text-text-muted hover:text-text-main">API keys</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

DashboardHomeClient.propTypes = {
  machineId: PropTypes.string.isRequired,
};
