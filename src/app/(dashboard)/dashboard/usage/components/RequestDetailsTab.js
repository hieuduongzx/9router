"use client";

import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  RequestDetailDrawer,
  CursorPagination,
  RequestTableColumnSettings,
  useRequestTableColumns,
  StatusPill,
  EmptyState,
  Spinner,
} from "@/shared/components";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { getUsagePeriodStartIso } from "@/shared/constants/usagePeriods";
import { getCachedTokens, getCacheCreationTokens, getInputTokens } from "@/shared/utils/requestTokens";
import { Icon } from "@/shared/components/ui/icon";

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
function formatRequestTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
function formatTraceId(value) {
  const traceId = String(value || "");
  if (!traceId) return "—";
  return traceId.length > 12 ? `${traceId.slice(0, 8)}…${traceId.slice(-4)}` : traceId;
}

function historyCell(id, detail) {
  switch (id) {
    case "time":
      return formatRequestTime(detail.timestamp);
    case "apiKey":
      return detail.apiKeyName || "No API key";
    case "input":
      return getInputTokens(detail.tokens).toLocaleString();
    case "cached":
      return getCachedTokens(detail.tokens).toLocaleString();
    case "cacheWrite":
      return getCacheCreationTokens(detail.tokens).toLocaleString();
    case "output":
      return (detail.tokens?.completion_tokens || 0).toLocaleString();
    case "timing":
      return formatTiming(detail.latency?.total);
    case "model":
      return detail.model || "—";
    case "mode":
      return detail.request?.stream === true
        ? "stream"
        : detail.request?.stream === false
        ? "sync"
        : "—";
    case "status":
      return <StatusPill status={detail.status} />;
    case "credits":
      return formatCost(detail.cost);
    case "trace":
      return formatTraceId(detail.id);
    default:
      return "—";
  }
}

function getEmptyMessage(period) {
  return period === "all"
    ? "No model requests have been recorded yet."
    : "No model requests were recorded in this period.";
}

export default function RequestDetailsTab({ period = "all", apiKeyId = "all", userId = "" }) {
  const { columns, visibility } = useRequestTableColumns("history");
  const visibleColumns = columns.filter((column) => visibility[column.id] !== false);
  const colSpan = Math.max(visibleColumns.length, 1);
  const [details, setDetails] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    totalItems: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const filterKey = `${period}|${apiKeyId}|${userId}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    if (pagination.page !== 1) setPagination((previous) => ({ ...previous, page: 1 }));
  }

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });
      const periodStart = getUsagePeriodStartIso(period);
      if (periodStart) params.append("startDate", periodStart);
      if (userId) params.append("userId", userId);
      if (apiKeyId && apiKeyId !== "all") params.append("apiKeyId", apiKeyId);

      const response = await fetch(`/api/usage/request-details?${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load model request history");
      setDetails(data.details || []);
      setPagination((previous) => ({ ...previous, ...data.pagination }));
      setError("");
    } catch (reason) {
      setDetails([]);
      setError(reason.message || "Unable to load model request history");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, period, userId, apiKeyId]);

  useEffect(() => {
    const id = setTimeout(fetchDetails, 0);
    return () => clearTimeout(id);
  }, [fetchDetails]);

  const handlePageSizeChange = (pageSize) => {
    setPagination((previous) => ({ ...previous, pageSize, page: 1 }));
  };

  const openDetail = (detail) => {
    setSelectedDetail(detail);
    setIsDrawerOpen(true);
  };

  const activeIndex = selectedDetail
    ? details.findIndex((d) => d.id === selectedDetail.id)
    : -1;
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex >= 0 && activeIndex < details.length - 1;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card padding="none" className="min-w-0">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle>Model request history</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Token, timing, and price details for requests in your current account scope.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {pagination.totalItems || 0} requests
            </span>
            <RequestTableColumnSettings table="history" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <caption className="sr-only">
                Model request history for the current account and date filters
              </caption>
              <thead className="border-b bg-muted/40">
                <tr>
                  {visibleColumns.map((column) => (
                    <th
                      key={column.id}
                      scope="col"
                      className={`px-4 py-2.5 ${column.align === "right" ? "text-right" : "text-left"}`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={colSpan} className="px-4 py-12 text-center">
                      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner size="sm" /> Loading model requests…
                      </span>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={colSpan} className="px-0 py-12 text-center">
                      <EmptyState
                        compact
                        icon="error"
                        title="Model request history could not be loaded"
                        description={error}
                      />
                    </td>
                  </tr>
                ) : details.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="px-0 py-12 text-center">
                      <EmptyState
                        compact
                        icon="history"
                        title={getEmptyMessage(period)}
                        description="Try a wider period or another API key."
                      />
                    </td>
                  </tr>
                ) : (
                  details.map((detail, index) => (
                    <tr
                      key={`${detail.id}-${index}`}
                      tabIndex={0}
                      onClick={() => openDetail(detail)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openDetail(detail);
                        }
                      }}
                      aria-label={`Open request ${detail.id || index + 1}`}
                      className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    >
                      {visibleColumns.map((column) => (
                        <td
                          key={column.id}
                          className={cellClass(column.id)}
                          title={cellTitle(column.id, detail)}
                        >
                          {historyCell(column.id, detail)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && details.length > 0 ? (
            <CursorPagination
              count={details.length}
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalPages={pagination.totalPages}
              onPageChange={(page) => setPagination((previous) => ({ ...previous, page }))}
              onPageSizeChange={handlePageSizeChange}
              pageSizeOptions={[10, 30, 50, 100]}
              className="border-t"
            />
          ) : null}
        </CardContent>
      </Card>

      <RequestDetailDrawer
        detail={selectedDetail}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        showProviderDetails={false}
        onPrev={hasPrev ? () => setSelectedDetail(details[activeIndex - 1]) : undefined}
        onNext={hasNext ? () => setSelectedDetail(details[activeIndex + 1]) : undefined}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />
    </div>
  );
}

const NUMERIC_CELLS = new Set(["input", "cached", "cacheWrite", "output", "timing", "credits"]);
const TRUNCATE_CELLS = new Set(["apiKey", "model", "trace"]);

function cellClass(id) {
  const numeric = NUMERIC_CELLS.has(id);
  const truncate = TRUNCATE_CELLS.has(id);
  return [
    "whitespace-nowrap px-4 py-3",
    numeric ? "text-right tabular-nums" : "",
    id === "credits" ? "font-medium" : numeric && id !== "timing" ? "font-medium" : "text-muted-foreground",
    id === "timing" ? "text-muted-foreground" : "",
    truncate ? "max-w-[200px] truncate" : "",
    id === "model" ? "max-w-[260px]" : "",
    id === "trace" ? "max-w-[180px]" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function cellTitle(id, detail) {
  if (id === "apiKey") return detail.apiKeyName || "No API key";
  if (id === "model") return detail.model || "Unknown model";
  if (id === "trace") return String(detail.id || "");
  return undefined;
}

RequestDetailsTab.propTypes = {
  period: PropTypes.string,
  apiKeyId: PropTypes.string,
  userId: PropTypes.string,
};
