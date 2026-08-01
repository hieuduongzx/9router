// Shared "time range" options for every dashboard that filters by period.
//
// One list, used by every PeriodDropdown — usage, activity, and the account
// pages — so no screen offers a different set of ranges than its neighbour.
// Deliberately short: a coarse ladder (hour → 6h → day → week → month) reads
// faster than a dozen near-identical windows. The API routes still accept the
// wider legacy set, so old deep links keep resolving.
//
// Every value here must be supported by PERIOD_MS / CHART_BUCKET_CONFIG in
// src/lib/db/repos/usageRepo.js and by VALID_PERIODS in the route handlers.
export const USAGE_PERIODS = [
  // `today` is calendar-day scoped, not a rolling window, so it has no `ms`;
  // endpoints resolve it server-side (see usageRepo `period === "today"`).
  { value: "today", label: "Today", ms: null },
  { value: "1h", label: "Last hour", ms: 60 * 60 * 1000 },
  { value: "6h", label: "Last 6 hours", ms: 6 * 60 * 60 * 1000 },
  { value: "24h", label: "Last 24 hours", ms: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "Last 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
  { value: "all", label: "All time", ms: null },
];

/** Period values the dashboards offer — for route-level validation. */
export const USAGE_PERIOD_VALUES = USAGE_PERIODS.map((p) => p.value);

export function getUsagePeriodLabel(value) {
  return USAGE_PERIODS.find((p) => p.value === value)?.label || value;
}

/**
 * Client-side period → start Date ISO string (for endpoints that take startDate
 * directly). Returns "" for unbounded ranges ("all"), meaning "do not filter".
 */
export function getUsagePeriodStartIso(period) {
  // Calendar-day scoped, so it cannot be derived from a rolling `ms` window.
  if (period === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  const entry = USAGE_PERIODS.find((p) => p.value === period);
  if (!Number.isFinite(entry?.ms)) return "";
  return new Date(Date.now() - entry.ms).toISOString();
}
