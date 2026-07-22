"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import RequestDetailDrawer from "@/shared/components/RequestDetailDrawer";
import Pagination from "@/shared/components/Pagination";
import SegmentedControl from "@/shared/components/SegmentedControl";
import { cn } from "@/shared/utils/cn";

const MONEY_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

const QUICK_PERIODS = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
  { value: "all", label: "All" },
];
const QUICK_PERIODS_WITH_CUSTOM = [...QUICK_PERIODS, { value: "custom", label: "Custom" }];

function getQuickPeriodStart(period) {
  if (period === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  const days = { "24h": 1, "7d": 7, "30d": 30, "60d": 60 }[period];
  return days ? new Date(Date.now() - days * 86_400_000).toISOString() : "";
}

function formatCost(value) {
  return Number.isFinite(value) ? MONEY_FORMAT.format(value) : "—";
}

function getCachedTokens(tokens) {
  return tokens?.cached_tokens || tokens?.cache_read_input_tokens || 0;
}

function getCacheCreationTokens(tokens) {
  return tokens?.cache_creation_input_tokens || 0;
}

function getInputTokens(tokens) {
  const prompt = tokens?.prompt_tokens || tokens?.input_tokens || 0;
  const cache = getCachedTokens(tokens);
  return prompt < cache ? cache : prompt;
}

export default function RequestDetailsTab() {
  const [details, setDetails] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [filters, setFilters] = useState({ period: "all", startDate: "", endDate: "" });

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });
      const quickPeriodStart = getQuickPeriodStart(filters.period);
      if (filters.startDate) params.append("startDate", filters.startDate);
      else if (quickPeriodStart) params.append("startDate", quickPeriodStart);
      if (filters.endDate) params.append("endDate", filters.endDate);

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
  }, [pagination.page, pagination.pageSize, filters]);

  useEffect(() => {
    const id = setTimeout(fetchDetails, 0);
    return () => clearTimeout(id);
  }, [fetchDetails]);

  const handlePageSizeChange = (pageSize) => {
    setPagination((previous) => ({ ...previous, pageSize, page: 1 }));
  };

  const handleQuickPeriodChange = (period) => {
    if (period === "custom") return;
    setFilters({ period, startDate: "", endDate: "" });
    setPagination((previous) => ({ ...previous, page: 1 }));
  };

  const handleDateChange = (field, value) => {
    setFilters((previous) => ({ ...previous, period: "custom", [field]: value }));
    setPagination((previous) => ({ ...previous, page: 1 }));
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card padding="md">
        <div className="flex flex-col gap-4">
          <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-text-main">Quick range</p>
              <p className="mt-0.5 text-xs text-text-muted">Filter requests without entering exact dates.</p>
            </div>
            <SegmentedControl
              options={filters.period === "custom" ? QUICK_PERIODS_WITH_CUSTOM : QUICK_PERIODS}
              value={filters.period}
              onChange={handleQuickPeriodChange}
              size="sm"
              className="w-full lg:w-auto"
            />
          </div>
          <div className="flex flex-col gap-4 border-t border-border-subtle pt-4 lg:flex-row lg:items-end">
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor="start-date-filter" className="text-sm font-medium text-text-main">Start date</label>
                <input
                  id="start-date-filter"
                  type="datetime-local"
                  value={filters.startDate}
                  onChange={(event) => handleDateChange("startDate", event.target.value)}
                  className={cn(
                    "h-9 w-full min-w-0 rounded-lg border border-black/10 bg-surface px-3 text-sm text-text-main dark:border-white/10",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20",
                  )}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor="end-date-filter" className="text-sm font-medium text-text-main">End date</label>
                <input
                  id="end-date-filter"
                  type="datetime-local"
                  value={filters.endDate}
                  onChange={(event) => handleDateChange("endDate", event.target.value)}
                  className={cn(
                    "h-9 w-full min-w-0 rounded-lg border border-black/10 bg-surface px-3 text-sm text-text-main dark:border-white/10",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20",
                  )}
                />
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setFilters({ period: "all", startDate: "", endDate: "" });
                setPagination((previous) => ({ ...previous, page: 1 }));
              }}
              disabled={filters.period === "all" && !filters.startDate && !filters.endDate}
              className="w-full lg:w-auto"
            >
              Clear filters
            </Button>
          </div>
        </div>
      </Card>

      {error && <div role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

      <Card padding="none" className="min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-text-main">Model request history</h2>
            <p className="mt-0.5 text-xs text-text-muted">Token, latency, and price details for requests in your current account scope.</p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-text-muted">{pagination.totalItems || 0} requests</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-xs leading-tight">
            <caption className="sr-only">Model request history for the current account and date filters</caption>
            <thead className="border-b border-border-subtle bg-bg-alt/60 text-text-muted">
              <tr>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left font-medium">Timestamp</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left font-medium">Model</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right font-medium">Input</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right font-medium">Cached</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right font-medium">Cache create</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right font-medium">Output</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right font-medium">Price</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left font-medium">Latency</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-text-muted">Loading model requests…</td></tr>
              ) : details.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-text-muted">No model requests found.</td></tr>
              ) : details.map((detail, index) => (
                <tr key={`${detail.id}-${index}`} className="transition-colors hover:bg-bg-alt/60">
                  <td className="whitespace-nowrap px-3 py-2.5 text-text-muted tabular-nums">{new Date(detail.timestamp).toLocaleString()}</td>
                  <td className="max-w-[240px] truncate px-3 py-2.5 font-mono font-medium text-text-main" title={detail.model}>{detail.model}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-main">{getInputTokens(detail.tokens).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-muted">{getCachedTokens(detail.tokens) > 0 ? getCachedTokens(detail.tokens).toLocaleString() : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-muted">{getCacheCreationTokens(detail.tokens) > 0 ? getCacheCreationTokens(detail.tokens).toLocaleString() : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-muted">{detail.tokens?.completion_tokens?.toLocaleString() || 0}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-medium tabular-nums text-warning">{formatCost(detail.cost)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-text-muted tabular-nums" title={`TTFT ${detail.latency?.ttft || 0}ms · Total ${detail.latency?.total || 0}ms`}>
                    {detail.latency?.ttft || 0}ms <span className="text-text-subtle">·</span> {detail.latency?.total || 0}ms
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDetail(detail);
                        setIsDrawerOpen(true);
                      }}
                      className="inline-flex h-9 items-center rounded-md border border-border px-3 text-[11px] font-medium text-text-main transition-colors hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && details.length > 0 && (
          <Pagination
            currentPage={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            onPageChange={(page) => setPagination((previous) => ({ ...previous, page }))}
            onPageSizeChange={handlePageSizeChange}
            className="border-t border-border-subtle px-4"
          />
        )}
      </Card>

      <RequestDetailDrawer
        detail={selectedDetail}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        showProviderDetails={false}
      />
    </div>
  );
}
