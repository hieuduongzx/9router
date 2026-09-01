"use client";

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RequestLogger } from "@/shared/components";
import Card from "@/shared/components/Card";
import StatTile from "@/shared/components/StatTile";
import {
  CHART_COLORS,
  CHART_TICK,
  CHART_TOOLTIP_LABEL,
  CHART_TOOLTIP_STYLE,
} from "@/shared/utils/chartTheme";


const NUMBER_FORMAT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function formatNumber(value) {
  return NUMBER_FORMAT.format(Number(value) || 0);
}

function formatLatency(value) {
  const latency = Number(value);
  if (!Number.isFinite(latency)) return "—";
  return latency >= 1000 ? `${(latency / 1000).toFixed(latency >= 10000 ? 1 : 2)}s` : `${Math.round(latency)}ms`;
}

function rate(part, total) {
  return total ? `${((part / total) * 100).toFixed(total >= 100 ? 1 : 0)}%` : "0%";
}

export default function RequestActivityTab({ period }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/usage/stats?period=${encodeURIComponent(period)}&scope=system`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Unable to load request activity");
        setError("");
        setStats(body);
      })
      .catch((reason) => {
        // Without this, a failed fetch renders as a legitimate "0 requests".
        if (reason?.name !== "AbortError") setError(reason.message || "Unable to load request activity");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [period]);

  const byStatus = stats?.byStatus || {};
  const success = Number(byStatus.success) || 0;
  const errors = Number(byStatus.error) || 0;
  const rateLimited = Number(byStatus.rate_limited) || 0;
  const totalRequests = Number(stats?.totalRequests) || 0;
  const latency = stats?.latency?.all || {};
  const outcomeData = [
    { name: "Successful", value: success, color: CHART_COLORS.cost },
    { name: "Errors", value: errors, color: CHART_COLORS.danger },
    { name: "Rate limited", value: rateLimited, color: CHART_COLORS.requests },
    { name: "Other", value: Number(byStatus.other) || 0, color: CHART_COLORS.info },
  ].filter((item) => item.value > 0);
  const latencyData = [
    { name: "Average", value: latency.avg },
    { name: "p50", value: latency.p50 },
    { name: "p95", value: latency.p95 },
  ].filter((item) => Number.isFinite(Number(item.value)));


  if (loading && !stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading request activity">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse bg-surface-2" />)}
      </div>
    );
  }

  if (error) {
    return <div role="alert" className="border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="tile-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile chip="requests" label="Total requests" value={formatNumber(totalRequests)} sub="Matches the System total for this period" />
        <StatTile chip="success" label="Successful" value={formatNumber(success)} sub={`${rate(success, totalRequests)} of all requests`} />
        <StatTile chip="danger" label="Errors / 429" value={formatNumber(errors + rateLimited)} sub={`${formatNumber(errors)} errors · ${formatNumber(rateLimited)} rate-limited`} />
        <StatTile chip="info" label="Latency p50 / p95" value={`${formatLatency(latency.p50)} / ${formatLatency(latency.p95)}`} sub={`Average ${formatLatency(latency.avg)} · n=${formatNumber(latency.count)}`} />
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="font-mono text-sm font-semibold text-foreground">Request outcomes</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Success, error, and rate-limit distribution.</p>
          </div>
          <div className="relative h-72 p-4">
            {outcomeData.length ? <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={outcomeData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={3} stroke="none" isAnimationActive={false}>
                    {outcomeData.map((item) => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL} formatter={(value, name) => [formatNumber(value), name]} />

                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-2xl font-semibold text-foreground">{formatNumber(totalRequests)}</span>
                <span className="text-xs text-muted-foreground">requests</span>
              </div>
            </> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No classified requests in this period.</div>}
          </div>
        </Card>

        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="font-mono text-sm font-semibold text-foreground">Request latency</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Average and percentile response times.</p>
          </div>
          <div className="h-72 p-4">
            {latencyData.length ? <ResponsiveContainer width="100%" height="100%">
              <BarChart data={latencyData} margin={{ top: 10, right: 16, left: 8 }}>
                <XAxis dataKey="name" tick={CHART_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={formatLatency} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL} formatter={(value) => [formatLatency(value), "Latency"]} />
                <Bar dataKey="value" fill={CHART_COLORS.info} maxBarSize={56} isAnimationActive={false} />
              </BarChart>

            </ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No latency samples in this period.</div>}
          </div>
        </Card>
      </div>
      <RequestLogger key={period} period={period} />
    </div>
  );
}

RequestActivityTab.propTypes = {
  period: PropTypes.string.isRequired,
};
