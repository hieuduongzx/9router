"use client";

import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import Card from "@/shared/components/Card";
import RequestDetailDrawer from "@/shared/components/RequestDetailDrawer";
import CursorPagination from "@/shared/components/CursorPagination";
import { getUsagePeriodStartIso } from "@/shared/constants/usagePeriods";

const MONEY_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

function getPeriodStart(period) {
  if (period === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  if (period === "all") return "";
  return getUsagePeriodStartIso(period);
}

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

function StatusPill({ status }) {
  const completed = status === "success" || status === "ok";
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${
        completed ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
      }`}
    >
      {completed ? "Completed" : "Failed"}
    </span>
  );
}

export default function RequestDetailsTab({ period = "all", apiKeyId = "all" }) {
  const [details, setDetails] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });
      const periodStart = getPeriodStart(period);
      if (periodStart) params.append("startDate", periodStart);

      const response = await fetch(`/api/usage/request-details?${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load model request history");
      setDetails(data.details || []);
      setPagination((previous) => ({ ...previous, ...data.pagination }));
      setError("");
    } catch (reason) {
      setError(reason.message || "Unable to load model request history");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, period]);

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
      {error && <div role="alert" className="rounded-sm border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

      <Card padding="none" className="min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-mono text-sm font-semibold text-text-main">Model request history</h2>
            <p className="mt-0.5 text-xs text-text-muted">Token, timing, and price details for requests in your current account scope.</p>
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">{pagination.totalItems || 0} requests</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-xs leading-tight">
            <caption className="sr-only">Model request history for the current account and date filters</caption>
            <thead className="border-b border-border font-mono text-text-muted">
              <tr>
                <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-left font-semibold uppercase tracking-wide">Time</th>
                <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-left font-semibold uppercase tracking-wide">Total Cost</th>
                <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-left font-semibold uppercase tracking-wide">Input Tokens</th>
                <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-left font-semibold uppercase tracking-wide">Output Tokens</th>
                <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-left font-semibold uppercase tracking-wide">Timing</th>
                <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-left font-semibold uppercase tracking-wide">Model</th>
                <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-left font-semibold uppercase tracking-wide">Mode</th>
                <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-left font-semibold uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-text-muted">Loading model requests…</td></tr>
              ) : details.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-text-muted">No model requests found.</td></tr>
              ) : details.map((detail, index) => (
                <tr
                  key={`${detail.id}-${index}`}
                  onClick={() => openDetail(detail)}
                  className={`cursor-pointer transition-colors hover:bg-surface-2/70 ${index % 2 === 1 ? "bg-surface-2/30" : ""}`}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-text-muted tabular-nums">{new Date(detail.timestamp).toLocaleString()}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono font-medium tabular-nums text-text-main">{formatCost(detail.cost)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono tabular-nums text-text-main">{getInputTokens(detail.tokens).toLocaleString()}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono tabular-nums text-text-main">{(detail.tokens?.completion_tokens || 0).toLocaleString()}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono tabular-nums text-text-muted">{formatTiming(detail.latency?.total)}</td>
                  <td className="max-w-[240px] truncate px-4 py-2.5 font-mono text-text-main" title={detail.model}>{detail.model}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-text-muted">{detail.request?.stream === true ? "stream" : detail.request?.stream === false ? "sync" : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5"><StatusPill status={detail.status} /></td>
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
};
