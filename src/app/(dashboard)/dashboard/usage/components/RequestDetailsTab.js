"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import RequestDetailDrawer from "@/shared/components/RequestDetailDrawer";
import Pagination from "@/shared/components/Pagination";
import { cn } from "@/shared/utils/cn";
import { AI_PROVIDERS, getProviderByAlias } from "@/shared/constants/providers";

const MONEY_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

function formatCost(value) {
  return Number.isFinite(value) ? MONEY_FORMAT.format(value) : "—";
}


function getProviderName(providerId, cache) {
  if (!providerId) return providerId;
  const cached = cache?.[providerId];

  if (typeof cached === 'string') {
    return cached;
  }

  if (cached?.name) {
    return cached.name;
  }

  const providerConfig = getProviderByAlias(providerId) || AI_PROVIDERS[providerId];
  return providerConfig?.name || providerId;
}


function getCachedTokens(tokens) {
  return tokens?.cached_tokens || tokens?.cache_read_input_tokens || 0;
}

function getCacheCreationTokens(tokens) {
  return tokens?.cache_creation_input_tokens || 0;
}

function getInputTokens(tokens) {
  const prompt = tokens?.prompt_tokens || tokens?.input_tokens || 0;
  // Canonical storage keeps prompt cache-inclusive. Legacy Claude rows may have
  // stored prompt cache-exclusive; fall back to cache when it's larger so old
  // rows don't under-report input.
  const cache = getCachedTokens(tokens);
  return prompt < cache ? cache : prompt;
}

export default function RequestDetailsTab() {
  const [details, setDetails] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [providers, setProviders] = useState([]);
  const [providerNameCache, setProviderNameCache] = useState(null);
  const [filters, setFilters] = useState({
    provider: "",
    startDate: "",
    endDate: ""
  });

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/usage/providers");
      if (!res.ok) throw new Error("Unable to load provider filters");
      const data = await res.json();
      const availableProviders = data.providers || [];
      setProviders(availableProviders);
      setProviderNameCache(Object.fromEntries(
        availableProviders.map((provider) => [provider.id, provider.name]),
      ));
    } catch (error) {
      console.error("Failed to fetch providers:", error);
    }
  }, []);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString()
      });
      if (filters.provider) params.append("provider", filters.provider);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const res = await fetch(`/api/usage/request-details?${params}`);
      const data = await res.json();

      setDetails(data.details || []);
      setPagination(prev => ({ ...prev, ...data.pagination }));
    } catch (error) {
      console.error("Failed to fetch request details:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters]);

  useEffect(() => {
    const id = setTimeout(fetchProviders, 0);
    return () => clearTimeout(id);
  }, [fetchProviders]);

  useEffect(() => {
    const id = setTimeout(fetchDetails, 0);
    return () => clearTimeout(id);
  }, [fetchDetails]);

  const handleViewDetail = (detail) => {
    setSelectedDetail(detail);
    setIsDrawerOpen(true);
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (newPageSize) => {
    setPagination(prev => ({ ...prev, pageSize: newPageSize, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({ provider: "", startDate: "", endDate: "" });
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card padding="md">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="provider-filter" className="text-sm font-medium text-text-main">Provider</label>
            <select
              id="provider-filter"
              value={filters.provider}
              onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
              className={cn(
                "h-9 px-3 rounded-lg border border-black/10 dark:border-white/10 bg-surface",
                "text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20",
                "w-full min-w-0 cursor-pointer"
              )}
              style={{ colorScheme: 'auto' }}
            >
              <option value="">All Providers</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="start-date-filter" className="text-sm font-medium text-text-main">Start Date</label>
            <input
              id="start-date-filter"
              type="datetime-local"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className={cn(
                "h-9 px-3 rounded-lg border border-black/10 dark:border-white/10 bg-surface",
                "w-full min-w-0 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
              )}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="end-date-filter" className="text-sm font-medium text-text-main">End Date</label>
            <input
              id="end-date-filter"
              type="datetime-local"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className={cn(
                "h-9 px-3 rounded-lg border border-black/10 dark:border-white/10 bg-surface",
                "w-full min-w-0 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
              )}
            />
          </div>
          
          <div className="flex min-w-0 flex-col gap-2 sm:col-span-2 lg:col-span-1">
            <span className="hidden text-sm font-medium text-text-main opacity-0 lg:block" aria-hidden="true">Clear</span>
            <Button 
              variant="ghost" 
              onClick={handleClearFilters}
              disabled={!filters.provider && !filters.startDate && !filters.endDate}
              className="w-full"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-xs leading-tight">
            <thead>
              <tr className="border-b border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.015]">
                <th className="whitespace-nowrap px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">Timestamp</th>
                <th className="whitespace-nowrap px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">Model</th>
                <th className="whitespace-nowrap px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">Provider</th>
                <th className="whitespace-nowrap px-2.5 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-text-muted">Input</th>
                <th className="whitespace-nowrap px-2.5 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-text-muted">Cached</th>
                <th className="whitespace-nowrap px-2.5 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-text-muted">Cache Create</th>
                <th className="whitespace-nowrap px-2.5 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-text-muted">Output</th>
                <th className="whitespace-nowrap px-2.5 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-text-muted">Price</th>
                <th className="whitespace-nowrap px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">Latency</th>
                <th className="whitespace-nowrap px-2.5 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-2.5 py-6 text-center text-xs text-text-muted">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : details.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-2.5 py-6 text-center text-xs text-text-muted">
                    No request details found
                  </td>
                </tr>
              ) : (
                details.map((detail, index) => (
                  <tr
                    key={`${detail.id}-${index}`}
                    className="border-b border-black/5 dark:border-white/5 last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="whitespace-nowrap px-2.5 py-1 text-xs text-text-main tabular-nums">
                      {new Date(detail.timestamp).toLocaleString()}
                    </td>
                    <td className="max-w-[200px] truncate px-2.5 py-1 font-mono text-xs text-text-main" title={detail.model}>
                      {detail.model}
                    </td>
                    <td className="max-w-[140px] truncate px-2.5 py-1 text-xs font-medium text-text-main" title={getProviderName(detail.provider, providerNameCache)}>
                      {getProviderName(detail.provider, providerNameCache)}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1 text-right font-mono text-xs text-text-main tabular-nums">
                      {getInputTokens(detail.tokens).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1 text-right font-mono text-xs text-text-main tabular-nums">
                      {getCachedTokens(detail.tokens) > 0 ? getCachedTokens(detail.tokens).toLocaleString() : "—"}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1 text-right font-mono text-xs text-text-main tabular-nums">
                      {getCacheCreationTokens(detail.tokens) > 0 ? getCacheCreationTokens(detail.tokens).toLocaleString() : "—"}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1 text-right font-mono text-xs text-text-main tabular-nums">
                      {detail.tokens?.completion_tokens?.toLocaleString() || 0}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1 text-right font-mono text-xs font-medium text-warning tabular-nums">
                      {formatCost(detail.cost)}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1 text-xs text-text-muted">
                      <span className="font-mono tabular-nums" title={`TTFT ${detail.latency?.ttft || 0}ms · Total ${detail.latency?.total || 0}ms`}>
                        {detail.latency?.ttft || 0}ms
                        <span className="mx-1 text-text-muted/50">·</span>
                        {detail.latency?.total || 0}ms
                      </span>
                    </td>
                    <td className="px-2.5 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleViewDetail(detail)}
                        className="inline-flex h-6 items-center rounded border border-border px-2 text-[11px] font-medium text-text-main hover:bg-bg-hover transition-colors"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && details.length > 0 && (
          <div className="border-t border-black/5 dark:border-white/5">
            <Pagination
              currentPage={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        )}
      </Card>

      <RequestDetailDrawer
        detail={selectedDetail}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        providerName={getProviderName(selectedDetail?.provider, providerNameCache)}
      />
    </div>
  );
}
