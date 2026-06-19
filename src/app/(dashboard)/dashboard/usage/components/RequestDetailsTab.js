"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import Pagination from "@/shared/components/Pagination";
import { cn } from "@/shared/utils/cn";
import { AI_PROVIDERS, getProviderByAlias } from "@/shared/constants/providers";

let providerNameCache = null;
let providerNodesCache = null;

async function fetchProviderNames() {
  if (providerNameCache && providerNodesCache) {
    return { providerNameCache, providerNodesCache };
  }

  const nodesRes = await fetch("/api/provider-nodes");
  const nodesData = await nodesRes.json();
  const nodes = nodesData.nodes || [];
  providerNodesCache = {};

  for (const node of nodes) {
    providerNodesCache[node.id] = node.name;
  }

  providerNameCache = {
    ...AI_PROVIDERS,
    ...providerNodesCache
  };

  return { providerNameCache, providerNodesCache };
}

function getProviderName(providerId, cache) {
  if (!providerId) return providerId;
  if (!cache) return providerId;

  const cached = cache[providerId];

  if (typeof cached === 'string') {
    return cached;
  }

  if (cached?.name) {
    return cached.name;
  }

  const providerConfig = getProviderByAlias(providerId) || AI_PROVIDERS[providerId];
  return providerConfig?.name || providerId;
}

function CollapsibleSection({ title, children, defaultOpen = false, icon = null }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {icon && <span className="material-symbols-outlined text-[16px] text-primary">{icon}</span>}
          <span className="font-medium text-[13px] text-text-main">{title}</span>
        </div>
        <span className={cn(
          "material-symbols-outlined text-[18px] text-text-muted transition-transform duration-200",
          isOpen ? "rotate-90" : ""
        )}>
          chevron_right
        </span>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

// Minimal time formatter
function formatTime(timestamp) {
  const d = new Date(timestamp);
  const time = d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { time, date };
}

// Status dot color
function statusColor(status) {
  if (status === "success") return "bg-green-500";
  if (status === "error") return "bg-red-500";
  return "bg-amber-500";
}

function statusBg(status) {
  if (status === "success") return "bg-green-500/10 text-green-600 dark:text-green-400";
  if (status === "error") return "bg-red-500/10 text-red-600 dark:text-red-400";
  return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
}

const AUTO_REFRESH_INTERVAL = 30000;

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
  const [providerNameCacheState, setProviderNameCacheState] = useState(null);
  const [filters, setFilters] = useState({
    provider: "",
    startDate: "",
    endDate: ""
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/usage/providers");
      const data = await res.json();
      setProviders(data.providers || []);

      const cache = await fetchProviderNames();
      setProviderNameCacheState(cache.providerNameCache);
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
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch request details:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      intervalRef.current = null;
      countdownRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => {
      fetchDetails();
      setCountdown(30);
    }, AUTO_REFRESH_INTERVAL);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoRefresh, fetchDetails]);

  // Pause when tab hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
      } else if (autoRefresh) {
        intervalRef.current = setInterval(() => { fetchDetails(); setCountdown(30); }, AUTO_REFRESH_INTERVAL);
        countdownRef.current = setInterval(() => setCountdown((p) => (p <= 1 ? 30 : p - 1)), 1000);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [autoRefresh, fetchDetails]);

  const handleViewDetail = (detail) => {
    setSelectedDetail(detail);
    setIsDrawerOpen(true);
  };

  const handleCloseModal = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedDetail(null), 200);
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

  const hasActiveFilters = filters.provider || filters.startDate || filters.endDate;

  const formatLastUpdated = () => {
    if (!lastUpdated) return "Never";
    const diffMs = Date.now() - lastUpdated;
    const s = Math.floor(diffMs / 1000);
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Top bar: filters + refresh controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="text-xs text-text-muted">Last updated: {formatLastUpdated()}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm"
            title={autoRefresh ? "Disable auto-refresh" : "Enable auto-refresh"}
          >
            <span className={`material-symbols-outlined text-[16px] ${autoRefresh ? "text-primary" : "text-text-muted"}`}>
              {autoRefresh ? "toggle_on" : "toggle_off"}
            </span>
            <span className="text-text-main">Auto</span>
            {autoRefresh && <span className="text-text-muted text-xs">{countdown}s</span>}
          </button>
          <button
            onClick={() => { fetchDetails(); setCountdown(30); }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm disabled:opacity-50"
            title="Refresh now"
          >
            <span className={`material-symbols-outlined text-[16px] text-text-main ${loading ? "animate-spin" : ""}`}>refresh</span>
            <span className="text-text-main">Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters — compact inline bar */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Provider</label>
          <select
            value={filters.provider}
            onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
            className="h-9 px-3 rounded-lg border border-border bg-transparent text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[150px]"
          >
            <option value="">All</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">From</label>
          <input
            type="datetime-local"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="h-9 px-3 rounded-lg border border-border bg-transparent text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">To</label>
          <input
            type="datetime-local"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="h-9 px-3 rounded-lg border border-border bg-transparent text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="h-9 px-3 rounded-lg text-xs font-medium text-text-muted hover:text-text-main hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <Card padding="none" className="border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-black/[0.02] dark:bg-white/[0.02]">
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-text-muted uppercase tracking-wider">Time</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-text-muted uppercase tracking-wider">Model</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-text-muted uppercase tracking-wider">Provider</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium text-text-muted uppercase tracking-wider">In</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium text-text-muted uppercase tracking-wider">Out</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium text-text-muted uppercase tracking-wider">Cost</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium text-text-muted uppercase tracking-wider">Latency</th>
                <th className="text-center px-4 py-2.5 text-[11px] font-medium text-text-muted uppercase tracking-wider">Status</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-[18px] text-text-muted">progress_activity</span>
                      <span className="text-sm text-text-muted">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : details.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="material-symbols-outlined text-[24px] text-text-muted/40">receipt_long</span>
                      <span className="text-sm text-text-muted">No requests found</span>
                    </div>
                  </td>
                </tr>
              ) : (
                details.map((detail, index) => {
                  const { time, date } = formatTime(detail.timestamp);
                  return (
                    <tr
                      key={`${detail.id}-${index}`}
                      onClick={() => handleViewDetail(detail)}
                      className="border-b border-black/[0.03] dark:border-white/[0.03] last:border-b-0 hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-2.5">
                        <span className="text-[13px] font-mono text-text-main">{time}</span>
                        <span className="text-[11px] text-text-muted ml-1.5">{date}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[12px] font-medium text-text-main bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 rounded">
                          {detail.model}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[12px] text-text-muted">
                          {getProviderName(detail.provider, providerNameCacheState)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-[13px] font-mono text-text-muted tabular-nums">
                          {detail.tokens?.prompt_tokens?.toLocaleString() || "0"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-[13px] font-mono text-text-muted tabular-nums">
                          {detail.tokens?.completion_tokens?.toLocaleString() || "0"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-[13px] font-mono text-green-600 dark:text-green-400 tabular-nums">
                          ${(detail.cost || 0).toFixed(4)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-[13px] font-mono text-text-muted tabular-nums">
                          {detail.latency?.total ? `${detail.latency.total}ms` : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium",
                          statusBg(detail.status)
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", statusColor(detail.status))} />
                          {detail.status || "pending"}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <span className="material-symbols-outlined text-[16px] text-text-muted/30 group-hover:text-text-muted transition-colors">
                          chevron_right
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && details.length > 0 && (
          <div className="border-t border-border">
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

      {/* Detail Modal */}
      <Modal
        isOpen={isDrawerOpen}
        onClose={handleCloseModal}
        title="Request Details"
        size="full"
        className="max-w-5xl"
      >
        {selectedDetail && (
          <div className="space-y-6">
            {/* Metadata grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetaField label="Model" value={
                <span className="text-[12px] font-medium text-text-main bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 rounded">
                  {selectedDetail.model}
                </span>
              } />
              <MetaField label="Provider" value={getProviderName(selectedDetail.provider, providerNameCacheState)} />
              <MetaField label="Status" value={
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium",
                  statusBg(selectedDetail.status)
                )}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", statusColor(selectedDetail.status))} />
                  {selectedDetail.status}
                </span>
              } />
              <MetaField label="Cost" value={
                <span className="font-mono text-green-600 dark:text-green-400">${(selectedDetail.cost || 0).toFixed(6)}</span>
              } />
              <MetaField label="Timestamp" value={
                <span className="font-mono text-[12px]">{new Date(selectedDetail.timestamp).toLocaleString()}</span>
              } />
              <MetaField label="Latency" value={
                <span className="font-mono text-[12px]">
                  {selectedDetail.latency?.ttft || 0}ms TTFT / {selectedDetail.latency?.total || 0}ms total
                </span>
              } />
              <MetaField label="Tokens" value={
                <span className="font-mono text-[12px]">
                  {(selectedDetail.tokens?.prompt_tokens || 0).toLocaleString()} in / {(selectedDetail.tokens?.completion_tokens || 0).toLocaleString()} out
                </span>
              } />
              <MetaField label="ID" value={
                <span className="font-mono text-[11px] text-text-muted truncate block max-w-[180px]">{selectedDetail.id}</span>
              } />
            </div>

            {/* Collapsible sections */}
            <div className="space-y-3">
              <CollapsibleSection title="Client Request (Input)" defaultOpen={true} icon="input">
                <CodeBlock content={selectedDetail.request} />
              </CollapsibleSection>

              {selectedDetail.providerRequest && (
                <CollapsibleSection title="Provider Request (Translated)" icon="translate">
                  <CodeBlock content={selectedDetail.providerRequest} />
                </CollapsibleSection>
              )}

              {selectedDetail.providerResponse && (
                <CollapsibleSection title="Provider Response (Raw)" icon="data_object">
                  <CodeBlock content={selectedDetail.providerResponse} />
                </CollapsibleSection>
              )}

              <CollapsibleSection title="Client Response (Final)" defaultOpen={true} icon="output">
                {selectedDetail.response?.thinking && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-[14px] text-amber-500">psychology</span>
                      <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Thinking Process</span>
                    </div>
                    <pre className="bg-amber-500/5 p-3 rounded-lg overflow-auto max-h-[200px] text-[12px] font-mono text-amber-700 dark:text-amber-300 border border-amber-500/10">
                      {selectedDetail.response.thinking}
                    </pre>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Content</span>
                </div>
                <CodeBlock content={selectedDetail.response?.content || "[No content]"} isString />
              </CollapsibleSection>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Helper: metadata field in the detail modal
function MetaField({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{label}</span>
      <div className="text-[13px] text-text-main">{value}</div>
    </div>
  );
}

// Helper: code block with consistent styling
function CodeBlock({ content, isString = false }) {
  return (
    <pre className="bg-black/[0.03] dark:bg-white/[0.03] p-3 rounded-lg overflow-auto max-h-[300px] text-[12px] font-mono text-text-main border border-border">
      {isString ? content : JSON.stringify(content, null, 2)}
    </pre>
  );
}
