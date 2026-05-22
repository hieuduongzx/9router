"use client";

import PropTypes from "prop-types";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, Button, Input, Toggle, CardSkeleton, Skeleton } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// Stat Card Component
function StatCard({ title, value, subtitle, icon, trend, trendUp }) {
  return (
    <Card padding="md" hover className="flex items-center gap-4">
      <div className="flex items-center justify-center size-11 rounded-lg bg-primary/[0.10] text-primary shrink-0">
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-text-muted uppercase tracking-wide font-medium">{title}</p>
        <p className="text-[22px] font-semibold text-foreground truncate tabular-nums leading-tight mt-0.5">{value}</p>
        {subtitle && <p className="text-[11px] text-text-muted mt-0.5 truncate">{subtitle}</p>}
      </div>
      {trend && (
        <div
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 ${
            trendUp
              ? "bg-green-500/[0.10] text-green-700 dark:text-green-400"
              : "bg-red-500/[0.10] text-red-700 dark:text-red-400"
          }`}
        >
          <span className="material-symbols-outlined text-[14px] leading-none">
            {trendUp ? "trending_up" : "trending_down"}
          </span>
          {trend}
        </div>
      )}
    </Card>
  );
}

function ActivityByHourChart({ hourlyData }) {
  return (
    <Card padding="md" className="overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">Hourly Activity</h3>
        <span className="text-[11px] text-text-muted">Local time (24h)</span>
      </div>
      {hourlyData.length === 0 ? (
        <div className="h-[100px] flex items-center justify-center text-text-muted text-sm">
          No data available
        </div>
      ) : (
        <>
          <div className="overflow-hidden">
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={hourlyData} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 9, fill: "currentColor", fillOpacity: 0.6 }}
                  tickLine={false}
                  axisLine={false}
                  interval={3}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "currentColor", fillOpacity: 0.6 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6 }}
                  formatter={(value, name, props) => {
                    const label = props.payload?.isCurrent
                      ? `${value} requests (current hour)`
                      : `${value} requests`;
                    return [label, "Count"];
                  }}
                />
                <Bar dataKey="requests" radius={[2, 2, 0, 0]}>
                  {hourlyData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isCurrent ? "#ea580c" : "#10b981"}
                      fillOpacity={entry.isCurrent ? 1 : 0.75}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 text-[11px] text-text-muted">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-sm bg-emerald-500" />
              <span>Other hours</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-sm bg-primary ring-1 ring-primary/40" />
              <span>Current hour</span>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function UsageTable({ requests }) {
  const fmtTokens = (n) => {
    if (!n) return "0";
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  const fmtCost = (n) => `$${(n || 0).toFixed(4)}`;

  return (
    <Card padding="none" className="flex flex-col h-[320px] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/[0.10] text-green-700 dark:text-green-400 text-[11px] font-medium rounded-full border border-green-500/20">
            <span className="size-1.5 rounded-full bg-green-500 animate-pulse-soft" />
            Live
          </span>
          <Button asChild variant="ghost" size="xs">
            <Link href="/dashboard/usage">View All</Link>
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        {!requests?.length ? (
          <div className="flex flex-col items-center justify-center gap-2 h-full text-text-muted text-sm py-6">
            <span className="material-symbols-outlined text-[40px] opacity-30">inbox</span>
            <span>No recent requests</span>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="bg-card sticky top-0 z-10 shadow-soft">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-text-muted uppercase tracking-wider text-[10px]">Model</th>
                <th className="px-3 py-2 text-right font-semibold text-text-muted uppercase tracking-wider text-[10px]">Token</th>
                <th className="px-3 py-2 text-right font-semibold text-text-muted uppercase tracking-wider text-[10px]">Cost</th>
                <th className="px-3 py-2 text-right font-semibold text-text-muted uppercase tracking-wider text-[10px]">Time</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req, i) => (
                <tr key={i} className="border-b border-border/60 hover:bg-bg-subtle/60 transition-colors">
                  <td className="px-3 py-2">
                    <div className="font-medium truncate max-w-[150px] text-foreground">{req.model || "Unknown"}</div>
                    <div className="text-[10px] text-text-muted truncate max-w-[150px]">{req.provider || "Unknown"}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {req.tokens ? fmtTokens(req.tokens) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-green-700 dark:text-green-400 tabular-nums">
                    {req.cost ? fmtCost(req.cost) : "$0.0000"}
                  </td>
                  <td className="px-3 py-2 text-right text-text-muted text-[10px] tabular-nums whitespace-nowrap">
                    {req.time || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

export default function DashboardPageClient({ machineId }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [modelData, setModelData] = useState([]);
  const [providerShareData, setProviderShareData] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [hourlyActivity, setHourlyActivity] = useState([]);
  const [successRateData, setSuccessRateData] = useState([]);
  const [latencyData, setLatencyData] = useState([]);
  const [costByProviderData, setCostByProviderData] = useState([]);
   
  // Endpoint state
  const [baseUrl, setBaseUrl] = useState("/v1");
  const [tunnelEnabled, setTunnelEnabled] = useState(false);
  const [tunnelPublicUrl, setTunnelPublicUrl] = useState("");
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [requireApiKey, setRequireApiKey] = useState(false);
  const [keysCount, setKeysCount] = useState(0);
  const [providersCount, setProvidersCount] = useState(0);

  const { copied, copy } = useCopyToClipboard();

  // Tunnel handlers
  const handleEnableTunnel = async () => {
    setTunnelLoading(true);
    try {
      const res = await fetch("/api/tunnel/enable", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTunnelEnabled(true);
        setTunnelPublicUrl(data.publicUrl || "");
      }
    } catch (error) {
      console.error("Error enabling tunnel:", error);
    } finally {
      setTunnelLoading(false);
    }
  };

  const handleDisableTunnel = async () => {
    setTunnelLoading(true);
    try {
      const res = await fetch("/api/tunnel/disable", { method: "POST" });
      if (res.ok) {
        setTunnelEnabled(false);
        setTunnelPublicUrl("");
      }
    } catch (error) {
      console.error("Error disabling tunnel:", error);
    } finally {
      setTunnelLoading(false);
    }
  };

  // Hydration fix
  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(`${window.location.origin}/v1`);
    }
  }, []);

  // Fetch all dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch provider node names for ID→name mapping
      let providerNodeNameMap = {};
      try {
        const nodesRes = await fetch("/api/provider-nodes");
        if (nodesRes.ok) {
          const nodesData = await nodesRes.json();
          for (const node of (nodesData.nodes || [])) {
            if (node.id && node.name) providerNodeNameMap[node.id] = node.name;
          }
        }
      } catch {}

      // Fetch stats
      const statsRes = await fetch("/api/usage/stats");
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);

        // Process top models from byModel
        const MODEL_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
        if (statsData.byModel) {
          const models = Object.entries(statsData.byModel)
            .map(([key, data]) => ({
              name: data.rawModel || key.split(" (")[0] || key,
              requests: data.requests || 0,
              tokens: (data.promptTokens || 0) + (data.completionTokens || 0),
              cost: data.cost || 0,
            }))
            .sort((a, b) => b.requests - a.requests)
            .slice(0, 8);
          setModelData(models.map((m, i) => ({ ...m, color: MODEL_COLORS[i % MODEL_COLORS.length] })));
        }

        // Process provider share from byProvider
        if (statsData.byProvider) {
          const providers = Object.entries(statsData.byProvider)
            .map(([key, data]) => ({
              name: providerNodeNameMap[key] || AI_PROVIDERS[key]?.name || key.toUpperCase(),
              requests: data.requests || 0,
              tokens: (data.promptTokens || 0) + (data.completionTokens || 0),
              cost: data.cost || 0,
            }))
            .sort((a, b) => b.requests - a.requests)
            .slice(0, 6);
          setProviderShareData(providers.map((p, i) => ({ ...p, color: MODEL_COLORS[i % MODEL_COLORS.length] })));
        }
      }

      // Fetch chart data
      const chartRes = await fetch("/api/usage/chart?period=7d");
      if (chartRes.ok) {
        const chartJson = await chartRes.json();
        setChartData(chartJson);
      }

      // Fetch recent requests from history (with cost data)
      const logsRes = await fetch("/api/usage/history/recent?limit=10");
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        const formattedLogs = (logsData.history || []).map(entry => {
          const totalTokens = (entry.tokens?.prompt_tokens || 0) + (entry.tokens?.completion_tokens || 0);
          const timestamp = new Date(entry.timestamp);
          return {
            time: timestamp.toISOString().slice(0, 19).replace("T", " "),
            model: entry.model || "Unknown",
            provider: entry.provider || "Unknown",
            tokens: totalTokens,
            cost: entry.cost || 0,
            status: entry.status || "success"
          };
        });
        setRecentRequests(formattedLogs);
      }

      // Fetch hourly activity
      const hourlyRes = await fetch("/api/usage/hourly");
      if (hourlyRes.ok) {
        const hourlyData = await hourlyRes.json();
        setHourlyActivity(hourlyData);
      }

      // Fetch analytics (success rate, latency, cost by provider)
      const analyticsRes = await fetch("/api/usage/analytics?period=7d");
      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setSuccessRateData(analyticsData.successRate || []);
        setLatencyData(analyticsData.latency || []);
        setCostByProviderData(analyticsData.costByProvider || []);
      }

      // Fetch settings
      const settingsRes = await fetch("/api/settings");
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        setRequireApiKey(settings.requireApiKey || false);
      }

      // Fetch tunnel status
      const tunnelRes = await fetch("/api/tunnel/status");
      if (tunnelRes.ok) {
        const tunnelData = await tunnelRes.json();
        setTunnelEnabled(tunnelData.enabled || false);
        setTunnelPublicUrl(tunnelData.publicUrl || "");
      }

      // Fetch API keys count
      const keysRes = await fetch("/api/keys");
      if (keysRes.ok) {
        const keysData = await keysRes.json();
        setKeysCount(keysData.keys?.length || 0);
      }

      // Fetch providers count
      const provRes = await fetch("/api/providers");
      if (provRes.ok) {
        const provData = await provRes.json();
        setProvidersCount(provData.connections?.length || 0);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const currentEndpoint = tunnelEnabled && tunnelPublicUrl ? `${tunnelPublicUrl}/v1` : baseUrl;

  const handleRequireApiKey = async (value) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireApiKey: value }),
      });
      if (res.ok) setRequireApiKey(value);
    } catch (error) {
      console.error("Error updating requireApiKey:", error);
    }
  };

  const fmtTokens = (n) => {
    if (!n) return "0";
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  const fmtCost = (n) => `$${(n || 0).toFixed(2)}`;

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <CardSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-[13px] text-text-muted mt-0.5">Live overview of your AI router</p>
        </div>
        <Button variant="outline" size="sm" icon="refresh" onClick={fetchDashboardData}>
          Refresh
        </Button>
      </div>

      {/* Endpoint Card */}
      <Card padding="lg" className="border-primary/20 bg-primary/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary text-primary-foreground shadow-soft shrink-0">
              <span className="material-symbols-outlined text-[20px]">api</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground tracking-tight">API Endpoint</h2>
              <p className="text-[12px] text-text-muted flex items-center gap-1.5 mt-0.5">
                {tunnelEnabled ? "Tunnel Active" : "Local Server"}
                {tunnelEnabled && (
                  <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                    <span className="size-1.5 rounded-full bg-green-500 animate-pulse-soft" />
                    Online
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-card">
              <span className="text-[12px] text-text-muted">Require API Key</span>
              <Toggle size="sm" checked={requireApiKey} onChange={() => handleRequireApiKey(!requireApiKey)} />
            </div>
            {tunnelEnabled ? (
              <Button
                size="sm"
                variant="outline"
                icon="cloud_off"
                onClick={handleDisableTunnel}
                disabled={tunnelLoading}
                className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 dark:border-red-500/30"
              >
                Disable Tunnel
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                icon="cloud_upload"
                onClick={handleEnableTunnel}
                disabled={tunnelLoading}
              >
                {tunnelLoading ? "Starting..." : "Enable Tunnel"}
              </Button>
            )}
            <Button asChild size="sm" variant="outline" icon="settings">
              <Link href="/dashboard/endpoint">Configure</Link>
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={currentEndpoint}
            readOnly
            className="flex-1"
            inputClassName={`font-mono text-[13px] ${tunnelEnabled ? "border-green-500/40 focus-visible:ring-green-500/30" : ""}`}
          />
          <Button
            variant="secondary"
            icon={copied === "endpoint" ? "check" : "content_copy"}
            onClick={() => copy(currentEndpoint, "endpoint")}
          >
            {copied === "endpoint" ? "Copied!" : "Copy"}
          </Button>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Requests"
          value={fmtTokens(stats?.totalRequests || 0)}
          subtitle="Last 7 days"
          icon="bar_chart"
          trend="12%"
          trendUp={true}
        />
        <StatCard
          title="Tokens Used"
          value={fmtTokens((stats?.totalPromptTokens || 0) + (stats?.totalCompletionTokens || 0))}
          subtitle={`${fmtTokens(stats?.totalPromptTokens || 0)} in · ${fmtTokens(stats?.totalCompletionTokens || 0)} out`}
          icon="token"
        />
        <StatCard
          title="Estimated Cost"
          value={fmtCost(stats?.totalCost)}
          subtitle="Based on provider rates"
          icon="payments"
        />
        <StatCard
          title="Active Providers"
          value={providersCount}
          subtitle={`${keysCount} API key${keysCount !== 1 ? "s" : ""} configured`}
          icon="dns"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage Chart */}
        <Card padding="md" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Usage Overview</h3>
            <div className="flex items-center gap-2 text-[11px] text-text-muted">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-primary" />
                Tokens
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ea580c" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.5 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.5 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtTokens}
                width={50}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value) => [fmtTokens(value), "Tokens"]
                }
              />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="#ea580c"
                strokeWidth={2}
                fill="url(#gradTokens)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Provider Share Donut */}
        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-4">Provider Share</h3>
          {providerShareData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-text-muted text-sm">
              No provider data
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={providerShareData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="requests"
                    nameKey="name"
                    stroke="none"
                  >
                    {providerShareData.map((entry, index) => (
                      <Cell key={`prov-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value, name) => [`${value} requests`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
                {providerShareData.map((p, i) => (
                  <span key={i} className="flex items-center gap-1 text-[10px] text-text-muted">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Analytics Row — Top Models + Token Split + Cost */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Models — Donut */}
        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top Models</h3>
          {modelData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-text-muted text-sm">
              No model data yet
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={modelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="requests"
                    nameKey="name"
                    stroke="none"
                  >
                    {modelData.map((entry, index) => (
                      <Cell key={`model-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value, name) => [`${value} requests`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
                {modelData.slice(0, 5).map((m, i) => (
                  <span key={i} className="flex items-center gap-1 text-[10px] text-text-muted">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                    <span className="truncate max-w-[80px]" title={m.name}>{m.name}</span>
                  </span>
                ))}
                {modelData.length > 5 && (
                  <span className="text-[10px] text-text-muted">+{modelData.length - 5} more</span>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Token Split — CSS progress bars + stats */}
        <Card padding="md" className="flex flex-col">
          <h3 className="text-sm font-semibold text-foreground mb-4">Token Breakdown</h3>
          {!stats?.totalPromptTokens && !stats?.totalCompletionTokens ? (
            <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
              No token data yet
            </div>
          ) : (() => {
            const input = stats?.totalPromptTokens || 0;
            const output = stats?.totalCompletionTokens || 0;
            const total = input + output;
            const inputPct = total > 0 ? ((input / total) * 100).toFixed(1) : 0;
            const outputPct = total > 0 ? ((output / total) * 100).toFixed(1) : 0;
            return (
              <div className="flex-1 flex flex-col justify-center gap-5">
                {/* Total */}
                <div className="text-center">
                  <p className="text-3xl font-semibold text-foreground tabular-nums tracking-tight">{fmtTokens(total)}</p>
                  <p className="text-[11px] text-text-muted uppercase tracking-wide mt-1">Total Tokens</p>
                </div>

                {/* Split bar */}
                <div>
                  <div className="flex h-3 rounded-full overflow-hidden bg-bg-subtle">
                    <div className="bg-blue-500 transition-all duration-500" style={{ width: `${inputPct}%` }} />
                    <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${outputPct}%` }} />
                  </div>
                  <div className="flex justify-between mt-2 text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-blue-500" />
                      <span className="text-text-muted">Input</span>
                      <span className="font-semibold text-foreground tabular-nums">{inputPct}%</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground tabular-nums">{outputPct}%</span>
                      <span className="text-text-muted">Output</span>
                      <span className="size-2 rounded-full bg-emerald-500" />
                    </span>
                  </div>
                </div>

                {/* Detail numbers */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="text-center p-3 rounded-lg border border-blue-500/20 bg-blue-500/[0.06]">
                    <p className="text-base font-semibold text-blue-700 dark:text-blue-400 tabular-nums">{fmtTokens(input)}</p>
                    <p className="text-[10px] text-text-muted uppercase tracking-wide mt-0.5">Input</p>
                  </div>
                  <div className="text-center p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06]">
                    <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">{fmtTokens(output)}</p>
                    <p className="text-[10px] text-text-muted uppercase tracking-wide mt-0.5">Output</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </Card>

        {/* Cost Over Time Chart */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Cost Overview</h3>
            <div className="flex items-center gap-3 text-[11px] text-text-muted">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-500" />
                Cost
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-blue-500" />
                Tokens
              </span>
            </div>
          </div>
          {chartData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-text-muted text-sm">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradTokens2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.5 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="cost"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "#10b981", fillOpacity: 0.7 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v.toFixed(2)}`}
                  width={50}
                />
                <YAxis
                  yAxisId="tokens"
                  orientation="left"
                  tick={{ fontSize: 10, fill: "#6366f1", fillOpacity: 0.7 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={fmtTokens}
                  width={50}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(value, name) => {
                    if (name === "cost") return [`$${Number(value).toFixed(4)}`, "Cost"];
                    return [fmtTokens(value), "Tokens"];
                  }}
                />
                <Area
                  yAxisId="tokens"
                  type="monotone"
                  dataKey="tokens"
                  stroke="#6366f1"
                  strokeWidth={1.5}
                  fill="url(#gradTokens2)"
                  strokeOpacity={0.6}
                />
                <Area
                  yAxisId="cost"
                  type="monotone"
                  dataKey="cost"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#gradCost)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Hourly Activity - full width row */}
      <div className="overflow-hidden">
        <ActivityByHourChart hourlyData={hourlyActivity} />
      </div>

      {/* Analytics Row — Success Rate + Latency + Cost by Provider */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Success / Error Rate */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Success Rate</h3>
            <div className="flex items-center gap-3 text-[11px] text-text-muted">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-500" />
                Success
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-red-500" />
                Errors
              </span>
            </div>
          </div>
          {successRateData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-text-muted text-sm">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={successRateData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.5 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.5 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(value, name) => {
                    if (name === "success") return [`${value} success`, "Success"];
                    return [`${value} errors`, "Errors"];
                  }}
                />
                <Bar dataKey="success" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="errors" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Average Latency */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Avg Latency</h3>
            <span className="text-[11px] text-text-muted">ms</span>
          </div>
          {latencyData.length === 0 || latencyData.every((d) => d.avgLatency === 0) ? (
            <div className="h-[250px] flex items-center justify-center text-text-muted text-sm">
              No latency data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={latencyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.5 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.5 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}ms`}
                  width={55}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(value) => [`${value}ms`, "Avg Latency"]}
                />
                <Area
                  type="monotone"
                  dataKey="avgLatency"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#gradLatency)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Cost by Provider */}
        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-4">Cost by Provider</h3>
          {costByProviderData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-text-muted text-sm">
              No cost data yet
            </div>
          ) : (
            <div className="space-y-2.5">
              {costByProviderData.map((p, i) => {
                const maxCost = costByProviderData[0]?.cost || 1;
                const pct = maxCost > 0 ? (p.cost / maxCost) * 100 : 0;
                const colors = ["#ea580c", "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#ef4444"];
                const color = colors[i % colors.length];
                return (
                  <div key={p.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-medium text-foreground truncate max-w-[140px]">{p.name}</span>
                      <span className="text-[12px] font-mono text-text-muted tabular-nums">${p.cost.toFixed(4)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-bg-subtle overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Recent Requests */}
        <div className="min-h-0">
          <UsageTable requests={recentRequests} />
        </div>

        {/* Quick Actions */}
        <Card padding="md">
          <h3 className="text-sm font-semibold mb-3 text-foreground">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/dashboard/providers", icon: "dns", label: "Providers", desc: "Connections" },
              { href: "/dashboard/api-keys", icon: "vpn_key", label: "API Keys", desc: "Manage keys" },
              { href: "/dashboard/combos", icon: "layers", label: "Combos", desc: "Fallback chains" },
              { href: "/dashboard/usage", icon: "bar_chart", label: "Usage", desc: "Detailed stats" },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="group flex items-start gap-3 px-3 py-2.5 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-bg-subtle/40 transition-[border-color,background-color] duration-150"
              >
                <span className="flex items-center justify-center size-8 rounded-md bg-primary/[0.08] text-primary shrink-0 group-hover:bg-primary/[0.14] transition-colors">
                  <span className="material-symbols-outlined text-[18px]">{a.icon}</span>
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{a.label}</p>
                  <p className="text-[11px] text-text-muted truncate">{a.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

DashboardPageClient.propTypes = {
  machineId: PropTypes.string,
};
