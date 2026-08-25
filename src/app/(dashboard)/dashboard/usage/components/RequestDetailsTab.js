"use client";

import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import Card from "@/shared/components/Card";
import RequestDetailDrawer from "@/shared/components/RequestDetailDrawer";
import CursorPagination from "@/shared/components/CursorPagination";
import StatusPill from "@/shared/components/StatusPill";
import { getUsagePeriodStartIso } from "@/shared/constants/usagePeriods";

const MONEY_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

function formatCost(value) {
  return Number.isFinite(value) ? MONEY_FORMAT.format(value) : "—";
}

function getCachedTokens(tokens) {
  return tokens?.cached_tokens || tokens?.cache_read_input_tokens || 0;
}

function getInputTokens(tokens) {
  const prompt = tokens?.prompt_tokens || tokens?.input_tokens || 0;
  const cache = getCachedTokens(tokens);
  return prompt < cache ? cache : prompt;
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

function getEmptyMessage(period) {
  return period === "all"
    ? "No model requests have been recorded yet."
    : "No model requests were recorded in this period.";
}

export default function RequestDetailsTab({ period = "all", apiKeyId = "all", userId = "" }) {
  const [details, setDetails] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // A narrower filter can have fewer pages, so send the reader back to page 1.
  // Adjusted during render (not in an effect) to avoid a cascading re-render.
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

  const activeIndex = selectedDetail ? details.findIndex((d) => d.id === selectedDetail.id) : -1;
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex >= 0 && activeIndex < details.length - 1;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card padding="none" className="min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div>
            <h2 className="font-mono text-sm font-semibold text-text-main">Model request history</h2>
            <p className="mt-0.5 text-xs text-text-muted">Token, timing, and price details for requests in your current account scope.</p>
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">{pagination.totalItems || 0} requests</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-xs leading-tight">
            <caption className="sr-only">Model request history for the current account and date filters</caption>
            <thead className="thead-data">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left">Time</th>
                <th scope="col" className="px-4 py-2.5 text-right">Input Tokens</th>
                <th scope="col" className="px-4 py-2.5 text-right">Output Tokens</th>
                <th scope="col" className="px-4 py-2.5 text-right">Timing</th>
                <th scope="col" className="px-4 py-2.5 text-left">Model</th>
                <th scope="col" className="px-4 py-2.5 text-left">Mode</th>
                <th scope="col" className="px-4 py-2.5 text-left">Status</th>
                <th scope="col" className="px-4 py-2.5 text-right">Credits</th>
                <th scope="col" className="px-4 py-2.5 text-left">Trace ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <span className="inline-flex items-center gap-2 text-sm text-text-muted">
                      <span className="material-symbols-outlined animate-spin text-[18px]" aria-hidden>progress_activity</span>
                      Loading model requests…
                    </span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div role="alert" className="inline-flex max-w-lg flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-[22px] text-danger" aria-hidden>error</span>
                      <span className="text-sm text-text-main">Model request history could not be loaded.</span>
                      <span className="font-mono text-xs text-danger">{error}</span>
                    </div>
                  </td>
                </tr>
              ) : details.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="inline-flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-[22px] text-text-subtle" aria-hidden>history</span>
                      <span className="text-sm text-text-main">{getEmptyMessage(period)}</span>
                      <span className="text-xs text-text-muted">Try a wider period or another API key.</span>
                    </div>
                  </td>
                </tr>
              ) : details.map((detail, index) => (
                <tr
                  key={`${detail.id}-${index}`}
                  onClick={() => openDetail(detail)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openDetail(detail);
                    }
                  }}
                  aria-label={`Open request ${detail.id || index + 1}`}
                  className="cursor-pointer transition-colors hover:bg-surface-2/70 focus-visible:bg-surface-2/70 focus-visible:outline-none"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-text-muted tabular-nums">{formatRequestTime(detail.timestamp)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-text-main">{getInputTokens(detail.tokens).toLocaleString()}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-text-main">{(detail.tokens?.completion_tokens || 0).toLocaleString()}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-text-muted">{formatTiming(detail.latency?.total)}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 font-mono text-text-main" title={detail.model || "Unknown model"}>{detail.model || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-text-muted">{detail.request?.stream === true ? "stream" : detail.request?.stream === false ? "sync" : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3"><StatusPill status={detail.status} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-medium tabular-nums text-text-main">{formatCost(detail.cost)}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 font-mono text-text-muted" title={String(detail.id || "")}>{formatTraceId(detail.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && details.length > 0 && (
          <CursorPagination
            count={details.length}
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={(page) => setPagination((previous) => ({ ...previous, page }))}
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={[10, 30, 50, 100]}
            className="border-t border-border"
          />
        )}
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

RequestDetailsTab.propTypes = {
  period: PropTypes.string,
  apiKeyId: PropTypes.string,
  userId: PropTypes.string,
};
