import { CHART_OTHER, CHART_RAMP } from "@/shared/utils/chartTheme.js";

const METRIC_PREFIX = {
  requests: "r_",
  cost: "c_",
  tokens: "t_",
};

export function normalizeUsageChartPoints(payload) {
  if (Array.isArray(payload)) return payload;
  return payload && Array.isArray(payload.points) ? payload.points : [];
}

export function normalizeUsageChartSeries(payload) {
  if (!payload || !Array.isArray(payload.series)) return [];

  const seen = new Set();
  const normalized = payload.series.filter((series) => {
    if (!series || typeof series.id !== "string" || !series.id || seen.has(series.id)) return false;
    seen.add(series.id);
    return true;
  });
  const named = normalized
    .filter((series) => series.id !== "other")
    .slice(0, CHART_RAMP.length)
    .map((series, index) => ({
      id: series.id,
      name: typeof series.name === "string" && series.name ? series.name : series.id,
      color: CHART_RAMP[index],
    }));
  const other = normalized.find((series) => series.id === "other");

  return other
    ? [...named, {
        id: other.id,
        name: typeof other.name === "string" && other.name ? other.name : "Other",
        color: CHART_OTHER,
      }]
    : named;
}

export function buildModelChartSeries(points, series, metric) {
  const prefix = METRIC_PREFIX[metric];
  if (!prefix || !Array.isArray(points) || !Array.isArray(series)) return [];

  return series.map((item) => {
    const dataKey = `${prefix}${item.id}`;
    return {
      ...item,
      dataKey,
      total: points.reduce((sum, point) => sum + (Number(point?.[dataKey]) || 0), 0),
    };
  });
}

export function usageChartHasData(points) {
  return Array.isArray(points) && points.some((point) =>
    (Number(point?.requests) || 0) > 0
    || (Number(point?.cost) || 0) > 0
    || (Number(point?.tokens) || 0) > 0
  );
}
