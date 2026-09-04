"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, Button, SegmentedControl, StatTile } from "@/shared/components";
import { useShellPath } from "@/shared/hooks/useShellPath";
import { Icon } from "@/shared/components/ui/icon";
import { CHART_COLORS, CHART_TICK, CHART_TOOLTIP_LABEL, CHART_TOOLTIP_STYLE } from "@/shared/utils/chartTheme";

const fmtTokens = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n || 0);
};

const fmtUptime = (ms) => {
  if (!ms || ms <= 0) return "—";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h${String(m % 60).padStart(2, "0")}m` : `${m}m`;
};

const WINDOW_TABS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7d", label: "7 days" },
  { id: "last30d", label: "30 days" },
  { id: "all", label: "All time" },
];

const REASON_LABELS = {
  applied: "Prompt exceeded threshold",
  below_threshold: "Below size threshold",
  not_profitable: "Compression not profitable",
  below_min_chars: "Below minimum chars",
  below_min_tokens: "Below minimum tokens",
  unsupported_model: "Model not in allowlist",
  unsupported_format: "Non-Claude request format",
  timeout: "Compression timed out",
  transform_error: "Transform error",
  passthrough: "Passthrough",
  disabled: "Disabled",
  not_installed: "Not installed",
};

export default function PxpipeClient() {
  const shellPath = useShellPath();
  const [status, setStatus] = useState(null);
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState(null);
  const [windowId, setWindowId] = useState("last7d");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, statsRes, logsRes] = await Promise.all([
        fetch("/api/pxpipe/status", { headers: { "Cache-Control": "no-store" } }),
        fetch("/api/pxpipe/stats"),
        fetch("/api/pxpipe/logs?limit=50"),
      ]);
      setStatus(await statusRes.json());
      setStats(await statsRes.json());
      setLogs(await logsRes.json());
      const healthRes = await fetch("/api/pxpipe/health", { method: "POST" });
      setHealth(await healthRes.json());
    } catch {
      /* sections render placeholders */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const w = stats?.windows?.[windowId];
  const statusLabel = !status
    ? "—"
    : !status.installed
      ? "Not installed"
      : health?.healthy
        ? "Healthy"
        : status.running
          ? "Running"
          : "Stopped";

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-mono text-sm font-semibold flex items-center gap-2">
          <Icon name="image" className="text-primary" />
          PXPIPE Dashboard
        </h2>
        <div className="flex items-center gap-2">
          <a href={shellPath("/dashboard/token-saver")} className="text-xs text-primary underline hover:opacity-80">
            Token Saver settings
          </a>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="tile-grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <StatTile
          chip={health?.healthy ? "cost" : status?.installed ? "danger" : "muted"}
          label="Status"
          value={statusLabel}
          sub={status?.enabled ? "Enabled in pipeline" : "Disabled in pipeline"}
        />
        <StatTile chip="info" label="Version" value={status?.version ? `v${status.version}` : "—"} sub="pxpipe-proxy" />
        <StatTile chip="info" label="Uptime" value={fmtUptime(status?.uptimeMs)} sub="module loaded" />
        <StatTile chip="requests" label="Requests" value={w ? w.requests.toLocaleString() : "—"} />
        <StatTile chip="cost" label="Compressed" value={w ? w.compressed.toLocaleString() : "—"} />
        <StatTile chip="muted" label="Bypassed" value={w ? w.bypassed.toLocaleString() : "—"} />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 className="font-mono font-medium">Token savings (estimated)</h3>
          <SegmentedControl
            size="sm"
            options={WINDOW_TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
            value={windowId}
            onChange={setWindowId}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Original tokens</p>
            <p className="font-mono text-lg font-semibold">{w ? fmtTokens(w.tokensBeforeEst) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">After PXPIPE</p>
            <p className="font-mono text-lg font-semibold">{w ? fmtTokens(w.tokensAfterEst) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saved</p>
            <p className="font-mono text-lg font-semibold text-success">{w ? fmtTokens(w.tokensSavedEst) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Reduction</p>
            <p className="font-mono text-lg font-semibold text-success">{w ? `${w.savedPct}%` : "—"}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Estimates from body size before/after imaging; billed usage per request
          (recorded on the Usage page) remains the ground truth. Images generated:{" "}
          {w ? w.imagesGenerated.toLocaleString() : "—"} · avg compression time:{" "}
          {w ? `${w.avgCompressionMs}ms` : "—"} · errors: {w ? w.errors : "—"}
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="font-mono font-medium mb-3">Tokens saved — last 30 days</h3>
        {stats?.timeline?.some((d) => d.tokensSavedEst > 0) ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats.timeline} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPxpipe" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.cost} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART_COLORS.cost} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="date" tick={CHART_TICK} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={CHART_TICK} tickFormatter={fmtTokens} width={48} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL} formatter={(v) => [fmtTokens(v), "Tokens saved"]} labelFormatter={(d) => d} />
              <Area type="monotone" dataKey="tokensSavedEst" stroke={CHART_COLORS.cost} fill="url(#gradPxpipe)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            No savings recorded yet — enable PXPIPE in the Token Saver and route a large Claude-format request.
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="font-mono font-medium mb-3">History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="thead-data">
              <tr className="text-left text-xs font-mono text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Model</th>
                <th className="py-2 pr-3 text-right">Original</th>
                <th className="py-2 pr-3 text-right">Compressed</th>
                <th className="py-2 pr-3 text-right">Saved</th>
                <th className="py-2 pr-3 text-right">%</th>
                <th className="py-2 pr-3 text-right">Duration</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recent || []).slice(0, 50).map((ev, i) => (
                <tr key={`${ev.ts}-${i}`} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 whitespace-nowrap font-mono text-muted-foreground">
                    {new Date(ev.ts).toLocaleString()}
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-xs">{ev.provider ? `${ev.provider}/${ev.model}` : ev.model || "—"}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-xs">
                    {ev.applied ? fmtTokens(ev.tokensBeforeEst) : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono text-xs">
                    {ev.applied ? fmtTokens(ev.tokensAfterEst) : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono text-xs text-success">
                    {ev.applied ? fmtTokens(ev.tokensSavedEst) : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono text-xs">
                    {ev.applied ? `${ev.savedPct}%` : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono text-xs">
                    {ev.durationMs != null ? `${ev.durationMs}ms` : "—"}
                  </td>
                  <td className="py-1.5">
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded-sm ${
                        ev.applied
                          ? "bg-success/15 text-success"
                          : ev.reason === "transform_error" || ev.reason === "timeout"
                            ? "bg-danger/15 text-danger"
                            : "bg-warning/15 text-warning"
                      }`}
                      title={ev.detail || ""}
                    >
                      {ev.applied ? "Compressed" : REASON_LABELS[ev.reason] || ev.reason}
                    </span>
                  </td>
                </tr>
              ))}
              {(!stats?.recent || stats.recent.length === 0) && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground text-sm">
                    No PXPIPE activity yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4" id="logs">
        <h3 className="font-mono font-medium mb-3">PXPIPE Logs</h3>
        {logs?.installLog ? (
          <pre className="terminal-block p-3 text-xs overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
            {logs.installLog}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">No install log yet.</p>
        )}
      </Card>
    </div>
  );
}
