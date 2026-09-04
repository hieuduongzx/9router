"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Card from "@/shared/components/Card";
import StatTile from "@/shared/components/StatTile";
import { useShellPath } from "@/shared/hooks/useShellPath";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import {
  CHART_BAR,
  CHART_COLORS,
  CHART_TICK,
  CHART_TOOLTIP_LABEL,
  CHART_TOOLTIP_STYLE,
} from "@/shared/utils/chartTheme";

const ProviderTopology = dynamic(() => import("./ProviderTopology"), { ssr: false });
const NUMBER_FORMAT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const MONEY_FORMAT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });


function formatNumber(value) {
  return NUMBER_FORMAT.format(Number(value) || 0);
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function providerLabel(providerId, nodeNames) {
  return nodeNames[providerId] || AI_PROVIDERS[providerId]?.name || providerId || "Unknown provider";
}

function connectionStatus(connection) {
  if (connection.isActive === false) return { label: "Disabled", dot: "bg-muted", text: "text-muted-foreground" };
  if (connection.testStatus === "unavailable") return { label: "Unavailable", dot: "bg-danger", text: "text-danger" };
  if (connection.testStatus === "active") return { label: "Healthy", dot: "bg-success", text: "text-success" };
  return { label: "Unchecked", dot: "bg-warning", text: "text-warning" };
}

export default function ProviderActivityTab({ period }) {
  const shellPath = useShellPath();
  const providersHref = shellPath("/dashboard/providers");
  const [connections, setConnections] = useState([]);
  const [nodeNames, setNodeNames] = useState({});
  const [stats, setStats] = useState(null);
  const [live, setLive] = useState({ activeRequests: [], recentRequests: [], errorProvider: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      fetch("/api/providers", { cache: "no-store", signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error("Unable to load provider connections");
        return response.json();
      }),
      fetch("/api/provider-nodes", { cache: "no-store", signal: controller.signal }).then((response) => response.ok ? response.json() : { nodes: [] }),
      fetch(`/api/usage/stats?period=${encodeURIComponent(period)}&scope=system`, { cache: "no-store", signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error("Unable to load provider usage");
        return response.json();
      }),
    ])
      .then(([providerData, nodesData, usageData]) => {
        setConnections(Array.isArray(providerData.connections) ? providerData.connections : []);
        setNodeNames(Object.fromEntries((nodesData.nodes || []).map((node) => [node.id, node.name])));
        setStats(usageData);
        setLive({
          activeRequests: usageData.activeRequests || [],
          recentRequests: usageData.recentRequests || [],
          errorProvider: usageData.errorProvider || "",
        });
        setError("");
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") setError(reason.message || "Unable to load provider activity");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [period]);

  useEffect(() => {
    const stream = new EventSource("/api/usage/stream");
    stream.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLive({
          activeRequests: data.activeRequests || [],
          recentRequests: data.recentRequests || [],
          errorProvider: data.errorProvider || "",
        });
      } catch {}
    };
    return () => stream.close();
  }, []);

  const activeConnections = useMemo(
    () => connections.filter((connection) => connection.isActive !== false),
    [connections],
  );
  const topologyProviders = useMemo(() => {
    const seen = new Set();
    return activeConnections
      .filter((connection) => {
        if (!connection.provider || seen.has(connection.provider)) return false;
        seen.add(connection.provider);
        return true;
      })
      .map((connection) => ({
        ...connection,
        name: providerLabel(connection.provider, nodeNames),
        nodeName: nodeNames[connection.provider] || null,
      }));
  }, [activeConnections, nodeNames]);
  const healthyCount = activeConnections.filter((connection) => connection.testStatus === "active").length;
  const issueCount = activeConnections.filter((connection) => connection.testStatus === "unavailable").length;

  const providerUsage = useMemo(
    () => Object.values(stats?.byProvider || {})
      .map((item) => ({ ...item, providerId: item.providerId || item.provider }))
      .sort((a, b) => (b.requests || 0) - (a.requests || 0)),
    [stats],
  );
  const accountUsage = useMemo(
    () => Object.values(stats?.byAccount || {}).sort((a, b) => (b.requests || 0) - (a.requests || 0)),
    [stats],
  );

  if (loading && !stats) {
    return <div className="h-72 animate-pulse bg-surface-2" aria-label="Loading provider activity" />;
  }
  if (error) {
    return <div role="alert" className="border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="tile-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile chip="info" label="Configured accounts" value={formatNumber(connections.length)} sub={`${activeConnections.length} enabled`} />
        <StatTile chip="info" label="Active providers" value={formatNumber(topologyProviders.length)} sub="Unique routing targets" />
        <StatTile chip="success" label="Healthy accounts" value={formatNumber(healthyCount)} sub={`${activeConnections.length - healthyCount - issueCount} unchecked`} />
        <StatTile chip="danger" label="Unavailable accounts" value={formatNumber(issueCount)} sub={issueCount ? "Needs operator attention" : "No reported failures"} />
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="font-mono text-sm font-semibold text-foreground">Requests by provider</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Compare routing volume across providers.</p>
          </div>
          <div className="h-72 p-4">
            {providerUsage.length ? <ResponsiveContainer width="100%" height="100%">
              <BarChart data={providerUsage.slice(0, 10)} layout="vertical" margin={{ left: 8, right: 20 }}>
                <CartesianGrid horizontal={false} stroke="var(--color-border)" strokeOpacity={0.65} />
                <XAxis type="number" tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
                <YAxis type="category" dataKey="providerId" tick={CHART_TICK} axisLine={false} tickLine={false} width={100} tickFormatter={(value) => providerLabel(value, nodeNames)} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL} formatter={(value) => [formatNumber(value), "Requests"]} labelFormatter={(value) => providerLabel(value, nodeNames)} />
                <Bar dataKey="requests" fill={CHART_BAR} maxBarSize={24} isAnimationActive={false} />

              </BarChart>
            </ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No provider traffic in this period.</div>}
          </div>
        </Card>

        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="font-mono text-sm font-semibold text-foreground">Spend by provider</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Estimated upstream cost by routing target.</p>
          </div>
          <div className="h-72 p-4">
            {providerUsage.length ? <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...providerUsage].sort((a, b) => (b.cost || 0) - (a.cost || 0)).slice(0, 10)} layout="vertical" margin={{ left: 8, right: 20 }}>
                <CartesianGrid horizontal={false} stroke="var(--color-border)" strokeOpacity={0.65} />
                <XAxis type="number" tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(value) => `$${Number(value).toFixed(2)}`} />
                <YAxis type="category" dataKey="providerId" tick={CHART_TICK} axisLine={false} tickLine={false} width={100} tickFormatter={(value) => providerLabel(value, nodeNames)} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL} formatter={(value) => [MONEY_FORMAT.format(Number(value) || 0), "Spend"]} labelFormatter={(value) => providerLabel(value, nodeNames)} />
                <Bar dataKey="cost" fill={CHART_BAR} maxBarSize={24} isAnimationActive={false} />

              </BarChart>
            </ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No provider spend in this period.</div>}
          </div>
        </Card>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="font-mono text-sm font-semibold text-foreground">Live routing topology</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Active request paths and the most recently selected provider.</p>
          </div>
          <div className="p-3">
            <ProviderTopology
              providers={topologyProviders}
              activeRequests={live.activeRequests}
              lastProvider={live.recentRequests?.[0]?.provider || ""}
              errorProvider={live.errorProvider}
            />
          </div>
        </Card>

        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
            <div>
              <h2 className="font-mono text-sm font-semibold text-foreground">Connection health</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Account-level availability reported by provider checks.</p>
            </div>
            <Link href={providersHref} className="shrink-0 text-xs font-medium text-primary hover:underline">Manage</Link>
          </div>
          <div className="max-h-[520px] divide-y divide-border-subtle overflow-y-auto">
            {connections.map((connection) => {
              const status = connectionStatus(connection);
              return (
                <Link key={connection.id} href={`${providersHref}/${connection.provider}`} className="flex min-w-0 items-center gap-3 px-5 py-3 transition-colors hover:bg-bg-alt">
                  <span className={`size-2 shrink-0 ${status.dot}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs font-medium text-foreground">{connection.name || providerLabel(connection.provider, nodeNames)}</span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">{providerLabel(connection.provider, nodeNames)}</span>
                  </span>
                  <span className={`shrink-0 font-mono text-[10px] font-medium ${status.text}`}>{status.label}</span>
                </Link>
              );
            })}
            {connections.length === 0 && <div className="px-5 py-10 text-center text-sm text-muted-foreground">No provider accounts configured.</div>}
          </div>
        </Card>
      </div>

      <Card padding="none" className="min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div>
            <h2 className="font-mono text-sm font-semibold text-foreground">Usage by provider</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Operational traffic distribution for the selected period.</p>
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{providerUsage.length} providers</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="thead-data">
              <tr>
                <th className="px-5 py-3 font-mono font-medium">Provider</th>
                <th className="px-4 py-3 text-right font-mono font-medium">Requests</th>
                <th className="px-4 py-3 text-right font-mono font-medium">Input</th>
                <th className="px-4 py-3 text-right font-mono font-medium">Output</th>
                <th className="px-4 py-3 text-right font-mono font-medium">Cost</th>
                <th className="px-5 py-3 text-right font-mono font-medium">Last request</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {providerUsage.map((item) => (
                <tr key={item.providerId} className="hover:bg-bg-alt/60">
                  <td className="px-5 py-3.5 font-mono font-medium text-foreground">{providerLabel(item.providerId, nodeNames)}</td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-foreground">{formatNumber(item.requests)}</td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-muted-foreground">{formatNumber(item.promptTokens)}</td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-muted-foreground">{formatNumber(item.completionTokens)}</td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-muted-foreground">{MONEY_FORMAT.format(Number(item.cost) || 0)}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono text-muted-foreground">{formatTime(item.lastUsed)}</td>
                </tr>
              ))}
              {providerUsage.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">No provider traffic in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding="none" className="min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div>
            <h2 className="font-mono text-sm font-semibold text-foreground">Usage by provider account</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Traffic attributed to individual configured credentials.</p>
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{accountUsage.length} accounts</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="thead-data">
              <tr>
                <th className="px-5 py-3 font-mono font-medium">Account</th>
                <th className="px-4 py-3 font-mono font-medium">Provider</th>
                <th className="px-4 py-3 text-right font-mono font-medium">Requests</th>
                <th className="px-4 py-3 text-right font-mono font-medium">Tokens</th>
                <th className="px-4 py-3 text-right font-mono font-medium">Cost</th>
                <th className="px-5 py-3 text-right font-mono font-medium">Last request</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {accountUsage.map((item, index) => (
                <tr key={item.connectionId || `${item.accountName}-${index}`} className="hover:bg-bg-alt/60">
                  <td className="px-5 py-3.5 font-mono font-medium text-foreground">{item.accountName || "Unnamed account"}</td>
                  <td className="px-4 py-3.5 font-mono text-muted-foreground">{providerLabel(item.provider, nodeNames)}</td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-foreground">{formatNumber(item.requests)}</td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-muted-foreground">{formatNumber((item.promptTokens || 0) + (item.completionTokens || 0))}</td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-muted-foreground">{MONEY_FORMAT.format(Number(item.cost) || 0)}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono text-muted-foreground">{formatTime(item.lastUsed)}</td>
                </tr>
              ))}
              {accountUsage.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">No account-attributed provider traffic in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

ProviderActivityTab.propTypes = {
  period: PropTypes.string.isRequired,
};
