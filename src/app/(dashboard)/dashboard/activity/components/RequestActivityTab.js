"use client";

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { RequestLogger } from "@/shared/components";
import Card from "@/shared/components/Card";

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

function HealthCard({ icon, label, value, detail, tone = "text-text-main" }) {
  return (
    <Card padding="md" className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-muted">{label}</p>
          <p className={`mt-2 truncate text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
          <p className="mt-1 truncate text-[11px] text-text-muted">{detail}</p>
        </div>
        <span className="material-symbols-outlined text-[20px] text-text-muted">{icon}</span>
      </div>
    </Card>
  );
}

HealthCard.propTypes = {
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  detail: PropTypes.string.isRequired,
  tone: PropTypes.string,
};

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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HealthCard icon="check_circle" label="Successful" value={formatNumber(success)} detail={`${rate(success, classified)} of classified requests`} tone="text-success" />
        <HealthCard icon="error" label="Errors / 429" value={formatNumber(errors + rateLimited)} detail={`${formatNumber(errors)} errors · ${formatNumber(rateLimited)} rate-limited`} tone={errors + rateLimited > 0 ? "text-danger" : "text-text-main"} />
        <HealthCard icon="speed" label="Latency p50" value={formatLatency(latency.p50)} detail={`Average ${formatLatency(latency.avg)} · n=${formatNumber(latency.count)}`} tone="text-primary" />
        <HealthCard icon="network_ping" label="Latency p95" value={formatLatency(latency.p95)} detail="End-to-end request latency" tone="text-warning" />
      </div>
      <RequestLogger key={period} period={period} />
    </div>
  );
}

RequestActivityTab.propTypes = {
  period: PropTypes.string.isRequired,
};
