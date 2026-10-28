"use client";

import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { cn } from "@/shared/utils/cn";
import { USAGE_PERIODS, getUsagePeriodLabel, getUsagePeriodStartIso } from "@/shared/constants/usagePeriods";
import { Icon } from "@/shared/components/ui/icon";

/** Sentinel period meaning "use startDate/endDate instead of a rolling window". */
export const CUSTOM_PERIOD = "custom";

export const EMPTY_USAGE_FILTERS = {
  period: "24h",
  startDate: "",
  endDate: "",
  model: "",
  provider: "",
  status: "",
  userId: "",
};

const STATUS_LABELS = { success: "Succeeded", error: "Failed", rate_limited: "Rate limited" };

const CONTROL_CLASS = cn(
  "h-7 max-w-full appearance-none rounded-sm border border-border bg-surface pl-2.5 pr-7 font-sans text-[13px] font-medium leading-4 text-foreground",
  "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
  "disabled:cursor-not-allowed disabled:opacity-50",
);
const DATE_CLASS = cn(
  "h-7 rounded-sm border border-border bg-surface px-2 font-mono text-[12px] leading-4 text-foreground",
  "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
);

/** "2026-10-01" (a date input value) → ISO at the start or end of that local day. */
function dayToIso(day, endOfDay) {
  if (!day) return "";
  const date = new Date(`${day}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/**
 * Filter state → API query params. Rolling periods become `period` (when the
 * endpoint takes one) or a computed `startDate`; a custom range becomes
 * `startDate`/`endDate` covering whole local days.
 * @param {object} filters
 * @param {object} [options]
 * @param {boolean} [options.periodParam=true] send `period`; false → derive startDate
 */
export function usageFiltersToParams(filters, { periodParam = true } = {}) {
  const params = {};
  if (filters.period === CUSTOM_PERIOD) {
    const start = dayToIso(filters.startDate, false);
    const end = dayToIso(filters.endDate, true);
    if (start) params.startDate = start;
    if (end) params.endDate = end;
    if (periodParam) params.period = "all";
  } else if (periodParam) {
    params.period = filters.period || "all";
  } else {
    const start = getUsagePeriodStartIso(filters.period || "all");
    if (start) params.startDate = start;
  }
  for (const key of ["model", "provider", "status", "userId"]) {
    if (filters[key]) params[key] = filters[key];
  }
  return params;
}

/** How many non-period filters are narrowing the result. */
export function countActiveUsageFilters(filters) {
  return ["model", "provider", "status", "userId"].filter((key) => Boolean(filters[key])).length;
}

/**
 * Loads filter options for the caller's scope from /api/usage/facets.
 * @param {object} [options]
 * @param {"own"|"system"} [options.scope="own"]
 * @param {string} [options.userId] admin: one account's options
 */
export function useUsageFacets({ scope = "own", userId = "" } = {}) {
  const [facets, setFacets] = useState({ models: [], providers: [], statuses: [] });
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (scope === "system") params.set("scope", "system");
    if (userId) params.set("userId", userId);
    fetch(`/api/usage/facets?${params}`, { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (data) setFacets(data); })
      // Options are a convenience; the filter bar still works with empty lists.
      .catch(() => {});
    return () => controller.abort();
  }, [scope, userId]);
  return facets;
}

function FilterSelect({ label, value, onChange, options, allLabel, className }) {
  return (
    <label className={cn("relative inline-flex min-w-0 shrink-0", className)}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={cn(CONTROL_CLASS, value ? "border-primary/50 bg-primary/5" : "")}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.count ? `${option.label} (${option.count.toLocaleString()})` : option.label}
          </option>
        ))}
      </select>
      <Icon name="expand_more" className="pointer-events-none absolute right-1.5 top-1/2 size-[15px] -translate-y-1/2 text-muted-foreground" />
    </label>
  );
}

FilterSelect.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string, label: PropTypes.string, count: PropTypes.number })).isRequired,
  allLabel: PropTypes.string.isRequired,
  className: PropTypes.string,
};

/**
 * Period + model/provider/outcome/account filters with removable chips.
 * Controlled: `value` is the whole filter object, `onChange` receives the next one.
 */
export default function UsageFilterBar({
  value,
  onChange,
  facets,
  fields = ["period", "model", "provider", "status"],
  users = [],
  periodOptions = USAGE_PERIODS,
  allowCustomRange = true,
  className,
  trailing,
}) {
  const show = (field) => fields.includes(field);
  const set = (patch) => onChange({ ...value, ...patch });
  const isCustom = value.period === CUSTOM_PERIOD;

  const providerLabels = useMemo(
    () => Object.fromEntries((facets?.providers || []).map((option) => [option.value, option.label])),
    [facets],
  );
  const userLabels = useMemo(() => Object.fromEntries(users.map((option) => [option.value, option.label])), [users]);

  const chips = [];
  if (show("user") && value.userId) chips.push({ key: "userId", label: `Account: ${userLabels[value.userId] || value.userId}` });
  if (show("model") && value.model) chips.push({ key: "model", label: `Model: ${value.model}` });
  if (show("provider") && value.provider) chips.push({ key: "provider", label: `Provider: ${providerLabels[value.provider] || value.provider}` });
  if (show("status") && value.status) chips.push({ key: "status", label: `Outcome: ${STATUS_LABELS[value.status] || value.status}` });
  if (isCustom && (value.startDate || value.endDate)) {
    chips.push({ key: "range", label: `${value.startDate || "…"} → ${value.endDate || "today"}` });
  }

  const clearChip = (key) => {
    if (key === "range") set({ period: EMPTY_USAGE_FILTERS.period, startDate: "", endDate: "" });
    else set({ [key]: "" });
  };
  const clearAll = () => set({ model: "", provider: "", status: "", userId: "", ...(isCustom ? { period: EMPTY_USAGE_FILTERS.period, startDate: "", endDate: "" } : {}) });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {show("period") && (
          <label className="relative inline-flex shrink-0">
            <span className="sr-only">Time range</span>
            <select
              value={value.period}
              onChange={(event) => {
                const period = event.target.value;
                // Opening a custom range starts from the last week so both inputs have a value.
                if (period === CUSTOM_PERIOD && !value.startDate) {
                  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
                  set({ period, startDate: weekAgo, endDate: today });
                } else {
                  set({ period });
                }
              }}
              className={CONTROL_CLASS}
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
              {allowCustomRange && <option value={CUSTOM_PERIOD}>Custom range…</option>}
            </select>
            <Icon name="expand_more" className="pointer-events-none absolute right-1.5 top-1/2 size-[15px] -translate-y-1/2 text-muted-foreground" />
          </label>
        )}
        {show("period") && isCustom && (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              From
              <input type="date" value={value.startDate} max={value.endDate || today} onChange={(event) => set({ startDate: event.target.value })} className={DATE_CLASS} />
            </label>
            <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              To
              <input type="date" value={value.endDate} min={value.startDate || undefined} max={today} onChange={(event) => set({ endDate: event.target.value })} className={DATE_CLASS} />
            </label>
          </span>
        )}
        {show("user") && (
          <FilterSelect label="Account" value={value.userId} onChange={(userId) => set({ userId })} options={users} allLabel="All accounts" className="max-w-[200px]" />
        )}
        {show("model") && (
          <FilterSelect label="Model" value={value.model} onChange={(model) => set({ model })} options={facets?.models || []} allLabel="All models" className="max-w-[240px]" />
        )}
        {show("provider") && (
          <FilterSelect label="Provider" value={value.provider} onChange={(provider) => set({ provider })} options={facets?.providers || []} allLabel="All providers" className="max-w-[200px]" />
        )}
        {show("status") && (
          <FilterSelect
            label="Outcome"
            value={value.status}
            onChange={(status) => set({ status })}
            options={(facets?.statuses?.length ? facets.statuses : Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })))}
            allLabel="Any outcome"
          />
        )}
        {trailing ? <div className="ml-auto flex items-center gap-2">{trailing}</div> : null}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => clearChip(chip.key)}
              className="inline-flex h-6 max-w-full items-center gap-1 rounded-sm border border-primary/30 bg-primary/5 pl-2 pr-1 text-xs text-foreground hover:border-primary/60"
              aria-label={`Remove filter ${chip.label}`}
            >
              <span className="truncate">{chip.label}</span>
              <Icon name="close" className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          ))}
          {chips.length > 1 && (
            <button type="button" onClick={clearAll} className="h-6 px-1.5 text-xs font-medium text-primary hover:underline">
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

UsageFilterBar.propTypes = {
  value: PropTypes.shape({
    period: PropTypes.string,
    startDate: PropTypes.string,
    endDate: PropTypes.string,
    model: PropTypes.string,
    provider: PropTypes.string,
    status: PropTypes.string,
    userId: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  facets: PropTypes.shape({ models: PropTypes.array, providers: PropTypes.array, statuses: PropTypes.array }),
  fields: PropTypes.arrayOf(PropTypes.oneOf(["period", "model", "provider", "status", "user"])),
  users: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string, label: PropTypes.string })),
  periodOptions: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string, label: PropTypes.string })),
  allowCustomRange: PropTypes.bool,
  className: PropTypes.string,
  trailing: PropTypes.node,
};

/** Human label for a filter's time window, for headings and empty states. */
export function describeUsageWindow(filters) {
  if (filters.period === CUSTOM_PERIOD) return `${filters.startDate || "start"} → ${filters.endDate || "today"}`;
  return getUsagePeriodLabel(filters.period);
}
