export function normalizeUsageChartPoints(payload) {
  if (Array.isArray(payload)) return payload;
  return payload && Array.isArray(payload.points) ? payload.points : [];
}
