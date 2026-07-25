"use client";

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { RequestLogger } from "@/shared/components";
import StatTile from "@/shared/components/StatTile";

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

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/usage/stats?period=${encodeURIComponent(period)}&scope=system`, { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then(setStats)
      .catch(() => {});
    return () => controller.abort();
  }, [period]);

  const byStatus = stats?.byStatus || {};
  const success = Number(byStatus.success) || 0;
  const errors = Number(byStatus.error) || 0;
  const rateLimited = Number(byStatus.rate_limited) || 0;
  const classified = success + errors + rateLimited + (Number(byStatus.other) || 0);
  const latency = stats?.latency?.all || {};

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="tile-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile chip="cost" label="Successful" value={formatNumber(success)} sub={`${rate(success, classified)} of classified requests`} />
        <StatTile chip="danger" label="Errors / 429" value={formatNumber(errors + rateLimited)} sub={`${formatNumber(errors)} errors · ${formatNumber(rateLimited)} rate-limited`} />
        <StatTile chip="info" label="Latency p50" value={formatLatency(latency.p50)} sub={`Average ${formatLatency(latency.avg)} · n=${formatNumber(latency.count)}`} />
        <StatTile chip="requests" label="Latency p95" value={formatLatency(latency.p95)} sub="End-to-end request latency" />
      </div>
      <RequestLogger key={period} period={period} />
    </div>
  );
}

RequestActivityTab.propTypes = {
  period: PropTypes.string.isRequired,
};
