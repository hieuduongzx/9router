// Shared "time range" options for usage/activity dashboards.
// Keys must stay in sync with VALID_PERIODS in src/app/api/usage/*/route.js
// and PERIOD_MS / CHART_BUCKET_CONFIG in src/lib/db/repos/usageRepo.js.
export const USAGE_PERIODS = [
  { value: "5m", label: "Last 5 min", ms: 5 * 60 * 1000 },
  { value: "15m", label: "Last 15 min", ms: 15 * 60 * 1000 },
  { value: "1h", label: "Last hour", ms: 60 * 60 * 1000 },
  { value: "6h", label: "Last 6 hours", ms: 6 * 60 * 60 * 1000 },
  { value: "12h", label: "Last 12 hours", ms: 12 * 60 * 60 * 1000 },
  { value: "24h", label: "Last 24 hours", ms: 24 * 60 * 60 * 1000 },
  { value: "3d", label: "Last 3 days", ms: 3 * 24 * 60 * 60 * 1000 },
  { value: "7d", label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "14d", label: "Last 14 days", ms: 14 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "Last 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
  { value: "all", label: "All time", ms: null },
];

export function getUsagePeriodLabel(value) {
  return USAGE_PERIODS.find((p) => p.value === value)?.label || value;
}

/** Client-side period → start Date ISO string (for endpoints that take startDate directly). */
export function getUsagePeriodStartIso(period) {
  const entry = USAGE_PERIODS.find((p) => p.value === period);
  if (!Number.isFinite(entry?.ms)) return "";
  return new Date(Date.now() - entry.ms).toISOString();
}
