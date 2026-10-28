"use client";

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { RequestLogger } from "@/shared/components";
import Card from "@/shared/components/Card";
import StatTile from "@/shared/components/StatTile";

const NUMBER_FORMAT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const EXACT_FORMAT = new Intl.NumberFormat("en-US");

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

/**
 * Outcome split as one 100% bar plus an exact legend. A donut was used before,
 * but with a typical 98% success rate the failure slices became slivers — the
 * part an operator actually opens this tab for. Small segments get a minimum
 * width so they stay visible, and the legend carries the exact numbers.
 */
function OutcomeBar({ segments, total }) {
  const visible = segments.filter((segment) => segment.value > 0);
  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex h-4 w-full gap-0.5 overflow-hidden bg-surface-2"
        role="img"
        aria-label={visible.map((segment) => `${segment.name} ${rate(segment.value, total)}`).join(", ")}
      >
        {visible.map((segment) => (
          <span
            key={segment.name}
            className={segment.barClass}
            style={{ flexGrow: segment.value, flexBasis: 0, minWidth: "6px" }}
          />
        ))}
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {segments.map((segment) => (
          <div key={segment.name} className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2 text-sm">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <span className={`size-2.5 shrink-0 ${segment.barClass}`} aria-hidden="true" />
              {segment.name}
            </dt>
            <dd className="font-mono tabular-nums text-foreground">
              {EXACT_FORMAT.format(segment.value)}
              <span className="ml-2 text-xs text-muted-foreground">{rate(segment.value, total)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

OutcomeBar.propTypes = {
  segments: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string, value: PropTypes.number, barClass: PropTypes.string })).isRequired,
  total: PropTypes.number.isRequired,
};

/**
 * p50→p95 range per model on one shared axis. Three bars for avg/p50/p95 said
 * "how slow is the system"; the useful question is "which model is slow, and
 * how unpredictable is it" — the dot is the typical call, the bar its tail.
 */
function LatencyRanges({ rows }) {
  const axisMax = Math.max(...rows.map((row) => Number(row.p95) || Number(row.p50) || 0), 1);
  const position = (value) => `${Math.min(100, ((Number(value) || 0) / axisMax) * 100)}%`;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3" aria-label="Latency p50 to p95 by model">
        {rows.map((row) => (
          <li key={row.model} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate font-mono text-foreground" title={row.model}>{row.model}</span>
              <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                {formatLatency(row.p50)} – {formatLatency(row.p95)}
                <span className="ml-2 text-[11px]">n={formatNumber(row.count)}</span>
              </span>
            </div>
            <div className="relative h-3" aria-hidden="true">
              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
              <span
                className="absolute top-1/2 h-1.5 -translate-y-1/2 bg-primary/30"
                style={{ left: position(row.p50), width: `calc(${position(row.p95)} - ${position(row.p50)})` }}
              />
              <span
                className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary"
                style={{ left: position(row.p50) }}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-border-subtle pt-1.5 font-mono text-[11px] text-muted-foreground" aria-hidden="true">
        <span>0</span>
        <span>{formatLatency(axisMax / 2)}</span>
        <span>{formatLatency(axisMax)}</span>
      </div>
    </div>
  );
}

LatencyRanges.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.shape({ model: PropTypes.string, p50: PropTypes.number, p95: PropTypes.number, count: PropTypes.number })).isRequired,
};

export default function RequestActivityTab({ period }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

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
  const other = Number(byStatus.other) || 0;
  const totalRequests = Number(stats?.totalRequests) || 0;
  const latency = stats?.latency?.all || {};
  const latencyByModel = (stats?.latency?.byModel || []).filter((row) => Number.isFinite(Number(row.p50)));
  const classified = success + errors + rateLimited + other;
  const outcomeSegments = [
    { name: "Succeeded", value: success, barClass: "bg-success" },
    { name: "Failed", value: errors, barClass: "bg-danger" },
    { name: "Rate limited", value: rateLimited, barClass: "bg-warning" },
    { name: "Other", value: other, barClass: "bg-muted-foreground" },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {!expanded && (loading && !stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading request activity">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse bg-surface-2" />)}
        </div>
      ) : error ? (
        <div role="alert" className="border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      ) : <>
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
            <p className="mt-0.5 text-xs text-muted-foreground">Share of each outcome; filter the log below by outcome to see the failing calls.</p>
          </div>
          <div className="p-5">
            {classified > 0
              ? <OutcomeBar segments={outcomeSegments} total={classified} />
              : <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No classified requests in this period.</div>}
          </div>
        </Card>

        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="font-mono text-sm font-semibold text-foreground">Latency by model</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Dot = p50 (typical call), bar = p50 to p95 (slow tail). Successful calls only.</p>
          </div>
          <div className="p-5">
            {latencyByModel.length
              ? <LatencyRanges rows={latencyByModel} />
              : <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No latency samples in this period.</div>}
          </div>
        </Card>
      </div>
      </>)}
      <RequestLogger key={period} period={period} expanded={expanded} onToggleExpanded={() => setExpanded((value) => !value)} />
    </div>
  );
}

RequestActivityTab.propTypes = {
  period: PropTypes.string.isRequired,
};
