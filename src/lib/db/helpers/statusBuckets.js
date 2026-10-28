// Request outcome buckets shared by every usage filter.
//
// Stored statuses are free-form — "success", legacy "ok", "rate_limited",
// "error_502" — so a filter on "errors" cannot compare the column to a single
// string. These helpers keep the SQL predicate and the JS classifier in one
// place so a filtered table and its summary tiles always agree.

/** Outcome buckets a filter UI may ask for. */
export const USAGE_STATUS_BUCKETS = ["success", "error", "rate_limited"];

/** Free-form stored status → one of "success" | "error" | "rate_limited" | "other". */
export function normalizeUsageStatus(status) {
  const raw = String(status || "ok").trim().toLowerCase();
  if (!raw || raw === "ok" || raw === "success") return "success";
  if (raw.includes("429") || raw.includes("rate")) return "rate_limited";
  if (raw.includes("fail") || raw.includes("error") || raw === "error") return "error";
  return "other";
}

/**
 * SQL predicate selecting rows whose status falls in one bucket — the SQL twin
 * of `normalizeUsageStatus`. Returns null for an unknown bucket so callers can
 * reject the filter instead of silently matching nothing.
 * @param {string} column qualified column, e.g. "rd.status"
 * @param {string} bucket
 */
export function statusBucketClause(column, bucket) {
  const lowered = `LOWER(COALESCE(${column}, ''))`;
  const rateLimited = `(${lowered} LIKE '%429%' OR ${lowered} LIKE '%rate%')`;
  if (bucket === "success") return `(${lowered} IN ('', 'ok', 'success'))`;
  if (bucket === "rate_limited") return rateLimited;
  if (bucket === "error") return `(NOT ${rateLimited} AND (${lowered} LIKE '%fail%' OR ${lowered} LIKE '%error%'))`;
  return null;
}

/** A user-supplied date → ISO string, or null when it does not parse. */
export function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
