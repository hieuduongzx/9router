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
import { ArrowRight, RefreshCw, Users, Server, Activity, DollarSign } from "lucide-react";
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
  CHART_TICK,
  CHART_TOOLTIP_LABEL,
  CHART_TOOLTIP_STYLE,
} from "@/shared/utils/chartTheme";

const COLOR_INPUT = CHART_COLORS.input;
const COLOR_OUTPUT = CHART_COLORS.output;
const COLOR_COST = CHART_COLORS.cost;

const DEFAULT_PERIOD = "24h";

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

function sumPoints(points, key) {
  return points.reduce((total, point) => total + (Number(point[key]) || 0), 0);
}

async function fetchJson(path, signal) {
  const response = await fetch(path, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function AdminDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading admin dashboard">
      <div className="h-40 animate-pulse border border-border bg-surface-2" />
      <div className="h-32 animate-pulse border border-border bg-surface-2" />
      <div className="h-[320px] animate-pulse border border-border bg-surface-2" />
    </div>
  );
}

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

export default function AdminDashboardClient() {
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [providers, setProviders] = useState([]);

  const range = useMemo(() => findRange(period), [period]);

  const fetchDashboardData = useCallback(async (signal) => {
    const results = await Promise.allSettled([
      fetchJson(`/api/usage/stats?period=${period}&scope=system`, signal),
      fetchJson(`/api/usage/chart?period=${period}&scope=system`, signal),
      fetchJson("/api/users", signal),
      fetchJson("/api/providers", signal),
    ]);

    if (signal?.aborted) return;

    const [statsResult, chartResult, usersResult, providersResult] = results;
    if (statsResult.status === "fulfilled") setStats(statsResult.value);
    if (chartResult.status === "fulfilled") {
      setChartData(normalizeUsageChartPoints(chartResult.value));
    }
    if (usersResult.status === "fulfilled") {
      setUsers(Array.isArray(usersResult.value?.users) ? usersResult.value.users : []);
    }
    if (providersResult.status === "fulfilled") {
      setProviders(Array.isArray(providersResult.value?.providers) ? providersResult.value.providers : []);
    }

    const usageFailed = statsResult.status === "rejected" || chartResult.status === "rejected";
    setError(usageFailed ? "System usage data could not be loaded. Try refreshing this page." : "");
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
  const totalTokens = promptTokens + completionTokens;
  const totalCost = Number(stats?.totalCost || 0);
  const totalRequests = Number(stats?.totalRequests || 0);

  const chartHasData = chartData.some((point) => Number(point.tokens) > 0);
  const activeUsers = users.filter((u) => u.isActive).length;
  const activeProviders = providers.filter((p) => p.connected > 0).length;

  if (loading && !stats) return <AdminDashboardSkeleton />;

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-8">
      {/* Admin Header */}
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center border border-border bg-primary/10">
          <span className="material-symbols-outlined text-[20px] text-primary">admin_panel_settings</span>
        </span>
        <div>
          <h1 className="font-mono text-lg font-semibold tracking-tight text-text-main">Admin Dashboard</h1>
          <p className="text-sm text-text-muted">System-wide overview and management</p>
        </div>
      </div>

      {error && (
        <div className="border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-text-main" role="status">
          {error}
        </div>
      )}

      {/* System Overview Stats */}
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
          System Overview
        </SectionLabel>

        <div className="tile-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            chip="requests"
            label="Total Requests"
            value={formatExact(totalRequests)}
            sub={`${formatNumber(totalTokens)} total tokens`}
          />
          <StatTile
            chip="tokens"
            label="Total Tokens"
            value={formatNumber(totalTokens)}
            sub={`${formatNumber(promptTokens)} in · ${formatNumber(completionTokens)} out`}
          />
          <StatTile
            chip="cost"
            label="System Cost"
            value={formatCurrency(totalCost)}
            sub={`${formatNumber(activeUsers)} active users`}
          />
          <StatTile
            chip="info"
            label="Active Providers"
            value={formatExact(activeProviders)}
            sub={`${providers.length} total providers`}
          />
        </div>
      </section>

      {/* Usage Chart */}
      <Card padding="none" className="min-w-0 overflow-hidden">
        <CardHead title="System Usage">
          <div className="hidden items-center gap-3 sm:flex">
            <LegendChip color={COLOR_INPUT} label="Input" />
            <LegendChip color={COLOR_OUTPUT} label="Output" />
            <LegendChip color={COLOR_COST} label="Cost" line />
          </div>
          <Link
            href="/admin/activity"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted transition-colors hover:text-text-main"
          >
            Activity
            <ArrowRight aria-hidden size={12} strokeWidth={2.5} />
          </Link>
        </CardHead>
        <div
          className="h-[300px] min-w-0 px-2 pb-3 pt-5 sm:px-4"
          role="img"
          aria-label="System-wide token usage and cost over the selected period"
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
              hint="System-wide usage data appears here as requests flow through the gateway."
            />
          )}
        </div>
      </Card>

      {/* Quick Links */}
      <section className="min-w-0">
        <SectionLabel>Quick Actions</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/users" className="group">
            <Card padding="md" className="transition-colors group-hover:border-primary/30">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-surface-2">
                  <Users aria-hidden size={16} strokeWidth={2.25} className="text-text-muted" />
                </span>
                <div>
                  <p className="font-mono text-sm font-semibold text-text-main">Manage Accounts</p>
                  <p className="text-xs text-text-muted">{activeUsers} active users</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/admin/providers" className="group">
            <Card padding="md" className="transition-colors group-hover:border-primary/30">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-surface-2">
                  <Server aria-hidden size={16} strokeWidth={2.25} className="text-text-muted" />
                </span>
                <div>
                  <p className="font-mono text-sm font-semibold text-text-main">Providers</p>
                  <p className="text-xs text-text-muted">{activeProviders} connected</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/admin/activity" className="group">
            <Card padding="md" className="transition-colors group-hover:border-primary/30">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-surface-2">
                  <Activity aria-hidden size={16} strokeWidth={2.25} className="text-text-muted" />
                </span>
                <div>
                  <p className="font-mono text-sm font-semibold text-text-main">Activity</p>
                  <p className="text-xs text-text-muted">System logs</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/admin/settings" className="group">
            <Card padding="md" className="transition-colors group-hover:border-primary/30">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-surface-2">
                  <DollarSign aria-hidden size={16} strokeWidth={2.25} className="text-text-muted" />
                </span>
                <div>
                  <p className="font-mono text-sm font-semibold text-text-main">Settings</p>
                  <p className="text-xs text-text-muted">System config</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </section>
    </div>
  );
}
