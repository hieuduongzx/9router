"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Card from "./Card";
import CursorPagination from "./CursorPagination";
import RequestDetailDrawer, { useRequestDetailDrawer } from "./RequestDetailDrawer";
import RequestTableColumnSettings, { useRequestTableColumns } from "./RequestTableColumnSettings";
import StatusPill from "./StatusPill";
import UsageFilterBar, { countActiveUsageFilters, useUsageFacets } from "./UsageFilterBar";
import { Icon } from "./ui/icon";

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");
const MONEY_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

function formatCost(value) {
  return Number.isFinite(value) ? MONEY_FORMAT.format(value) : "—";
}

function formatTiming(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value)) return "—";
  return value >= 1000 ? `${(value / 1000).toFixed(3)}s` : `${Math.round(value)}ms`;
}

function activityCell(id, log) {
  switch (id) {
    case "time":
      return new Date(log.timestamp).toLocaleString();
    case "account":
      return (
        <>
          <span className="block truncate font-medium text-foreground" title={log.username}>{log.username}</span>
          {log.email && <span className="block truncate text-[10px] text-muted-foreground" title={log.email}>{log.email}</span>}
        </>
      );
    case "apiKey":
      return log.apiKeyName || "No API key";
    case "cost":
      return formatCost(log.cost);
    case "input":
      return NUMBER_FORMAT.format(log.inputTokens || 0);
    case "cached":
      return NUMBER_FORMAT.format(log.cachedTokens || 0);
    case "cacheWrite":
      return NUMBER_FORMAT.format(log.cacheCreationTokens || 0);
    case "output":
      return NUMBER_FORMAT.format(log.outputTokens || 0);
    case "timing":
      return formatTiming(log.timingMs);
    case "model":
      return log.model;
    case "mode":
      return log.mode || "—";
    case "status":
      return <StatusPill status={log.status} />;
    default:
      return "—";
  }
}

function activityCellClass(id) {
  if (id === "account") return "max-w-[190px] px-4 py-2.5";
  if (id === "apiKey") return "max-w-[180px] truncate px-4 py-2.5 font-mono text-foreground";
  if (id === "model") return "max-w-[190px] truncate px-4 py-2.5 font-mono text-foreground";
  if (id === "status") return "whitespace-nowrap px-4 py-2.5";
  if (id === "cost") return "whitespace-nowrap px-4 py-2.5 font-mono font-medium tabular-nums text-foreground";
  if (id === "timing" || id === "mode") return "whitespace-nowrap px-4 py-2.5 font-mono tabular-nums text-muted-foreground";
  return "whitespace-nowrap px-4 py-2.5 font-mono tabular-nums text-foreground";
}

function activityCellTitle(id, log) {
  if (id === "apiKey") return log.apiKeyName || "No API key";
  if (id === "model") return log.model;
  return undefined;
}

/** Filters the log keeps in the URL, so a filtered view can be linked and reloaded. */
const URL_FILTER_KEYS = ["userId", "model", "provider", "status"];

/** Keyless rows have no owner; these sentinels let the account filter reach them. */
const SYSTEM_ACCOUNT_OPTIONS = [
  { value: "__local__", label: "Local / system (no key)" },
  { value: "__unassigned__", label: "Unassigned keys" },
];

function useAccountOptions() {
  const [options, setOptions] = useState(SYSTEM_ACCOUNT_OPTIONS);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/users?period=24h", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.users) return;
        const accounts = data.users
          .map((user) => ({ value: user.id, label: user.username || user.email || user.id }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setOptions([...accounts, ...SYSTEM_ACCOUNT_OPTIONS]);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return options;
}

export default function RequestLogger({ period = "all", expanded = false, onToggleExpanded }) {
  const { columns, visibility } = useRequestTableColumns("activity");
  const visibleColumns = columns.filter((column) => visibility[column.id] !== false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const facets = useUsageFacets({ scope: "system" });
  const accountOptions = useAccountOptions();
  const filters = useMemo(() => {
    const next = { period };
    for (const key of URL_FILTER_KEYS) next[key] = searchParams.get(key) || "";
    return next;
  }, [period, searchParams]);
  const filterKey = URL_FILTER_KEYS.map((key) => filters[key]).join("|");
  const activeFilterCount = countActiveUsageFilters(filters);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    totalItems: 0,
    totalPages: 0,
  });
  const {
    closeDetail,
    detailError,
    isDrawerOpen,
    loadingDetailId,
    selectedDetail,
    viewDetail,
  } = useRequestDetailDrawer();

  const activeLogIndex = selectedDetail ? logs.findIndex((l) => l.detailId === selectedDetail.id) : -1;
  const hasPrevLog = activeLogIndex > 0;
  const hasNextLog = activeLogIndex >= 0 && activeLogIndex < logs.length - 1;

  // A new filter combination starts from the first page; staying on page 7 of
  // the old result usually lands past the end of the new one.
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    if (page !== 1) setPage(1);
  }

  const setFilters = useCallback((next) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of URL_FILTER_KEYS) {
      if (next[key]) params.set(key, next[key]);
      else params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const fetchLogs = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams({
        period,
        page: String(page),
        pageSize: String(pageSize),
      });
      for (const key of URL_FILTER_KEYS) {
        if (filters[key]) params.set(key, filters[key]);
      }
      const response = await fetch(`/api/usage/request-logs?${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load request logs");
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setError("");
      if (data.pagination) {
        setPagination(data.pagination);
        if (data.pagination.page !== page) setPage(data.pagination.page);
      }
    } catch (fetchError) {
      // A background refresh keeps the last good page instead of blanking it;
      // an explicit load must not show stale rows as if they matched.
      if (showLoading) setLogs([]);
      setError(fetchError.message || "Unable to load request logs");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [page, pageSize, period, filters, setPage]);

  useEffect(() => {
    const id = setTimeout(fetchLogs, 0);
    return () => clearTimeout(id);
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const interval = setInterval(() => fetchLogs(false), 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);


  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-mono text-lg font-semibold text-foreground">Request Logs</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Account ownership is resolved from the API key used for each request.</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {onToggleExpanded && (
            <button
              type="button"
              onClick={onToggleExpanded}
              aria-pressed={expanded}
              className="inline-flex min-h-9 items-center gap-2 rounded-sm border border-border px-3 text-xs font-medium text-foreground hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Icon name={expanded ? "expand_less" : "expand_more"} className="size-4" aria-hidden="true" />
              {expanded ? "Show overview" : "Expand requests"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setAutoRefresh((value) => !value)}
            aria-pressed={autoRefresh}
            className="inline-flex items-center gap-2 font-mono text-xs font-medium text-muted-foreground"
          >
            <span>Auto refresh</span>
            <span className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors ${
              autoRefresh ? "border-primary bg-primary" : "border-border bg-surface-2"
            }`}>
              <span className={`inline-block size-3 rounded-full bg-white transition-transform ${
                autoRefresh ? "translate-x-5" : "translate-x-1"
              }`} />
            </span>
          </button>
          <RequestTableColumnSettings table="activity" />
        </div>
      </div>

      <UsageFilterBar
        value={filters}
        onChange={setFilters}
        facets={facets}
        users={accountOptions}
        fields={["user", "model", "provider", "status"]}
        trailing={
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {(pagination.totalItems || 0).toLocaleString()} {activeFilterCount ? "matching " : ""}requests
          </span>
        }
      />

      {error && !loading && logs.length > 0 && (
        <div className="rounded-sm border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground" role="status">
          Refresh failed ({error}). Showing the last loaded page.
        </div>
      )}

      {detailError && (
        <div className="rounded-sm border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {detailError}
        </div>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className={expanded ? "overflow-x-auto" : "max-h-[600px] overflow-auto"}>
          {loading && logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading logs...</div>
          ) : error && logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-danger" role="alert">Request logs could not be loaded: {error}</div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
              {activeFilterCount ? "No requests match these filters in this period." : "No request details recorded yet."}
              {activeFilterCount > 0 && (
                <button type="button" onClick={() => setFilters({})} className="text-xs font-medium text-primary hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full min-w-max border-collapse text-left text-xs">
              <thead className="thead-data">
                <tr>
                  {visibleColumns.map((column) => (
                    <th key={column.id} className="whitespace-nowrap px-4 py-2.5">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tbody-data">
                {logs.map((log) => (
                  <tr
                    key={log.detailId}
                    onClick={() => viewDetail(log)}
                    className={`cursor-pointer ${
                      loadingDetailId === log.detailId ? "opacity-60" : ""
                    }`}
                  >
                    {visibleColumns.map((column) => (
                      <td key={column.id} className={activityCellClass(column.id)} title={activityCellTitle(column.id, log)}>
                        {activityCell(column.id, log)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <CursorPagination
          count={logs.length}
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPage(1);
            setPageSize(value);
          }}
          pageSizeOptions={[10, 30, 50, 100]}
          className="border-t border-border"
        />
      </Card>

      <RequestDetailDrawer
        detail={selectedDetail}
        isOpen={isDrawerOpen}
        onClose={closeDetail}
        providerName={selectedDetail?.providerName || selectedDetail?.provider}
        onPrev={hasPrevLog ? () => viewDetail(logs[activeLogIndex - 1]) : undefined}
        onNext={hasNextLog ? () => viewDetail(logs[activeLogIndex + 1]) : undefined}
        hasPrev={hasPrevLog}
        hasNext={hasNextLog}
      />
    </div>
  );
}

RequestLogger.propTypes = {
  period: PropTypes.string,
  expanded: PropTypes.bool,
  onToggleExpanded: PropTypes.func,
};
