"use client";

import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import Card from "./Card";
import Pagination from "./Pagination";
import RequestDetailDrawer, { useRequestDetailDrawer } from "./RequestDetailDrawer";

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

function statusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("success") || value.includes("ok") || value === "200") return "text-success";
  if (value.includes("fail") || value.includes("error")) return "text-error";
  return "text-primary";
}

export default function RequestLogger({ period = "all" }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 30,
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

  const fetchLogs = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams({
        period,
        page: String(page),
        pageSize: String(pageSize),
      });
      const response = await fetch(`/api/usage/request-logs?${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load request logs");
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      if (data.pagination) {
        setPagination(data.pagination);
        if (data.pagination.page !== page) setPage(data.pagination.page);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [page, pageSize, period]);

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
          <h2 className="text-xl font-semibold text-text-main">Request Logs</h2>
          <p className="mt-0.5 text-xs text-text-muted">Account ownership is resolved from the API key used for each request.</p>
        </div>
        <button
          type="button"
          onClick={() => setAutoRefresh((value) => !value)}
          aria-pressed={autoRefresh}
          className="inline-flex items-center gap-2 self-start text-sm font-medium text-text-muted sm:self-auto"
        >
          <span>Auto refresh</span>
          <span className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors ${
            autoRefresh ? "border-primary bg-primary" : "border-border bg-bg-subtle"
          }`}>
            <span className={`inline-block size-3 rounded-full bg-white transition-transform ${
              autoRefresh ? "translate-x-5" : "translate-x-1"
            }`} />
          </span>
        </button>
      </div>

      {detailError && (
        <div className="rounded-lg border border-error/20 bg-error/5 px-3 py-2 text-sm text-error" role="alert">
          {detailError}
        </div>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className="max-h-[600px] overflow-auto">
          {loading && logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-muted">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-muted">No request details recorded yet.</div>
          ) : (
            <table className="w-full min-w-[1120px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-border bg-bg-subtle text-text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Date & time</th>
                  <th className="px-3 py-2 font-medium">Account</th>
                  <th className="px-3 py-2 font-medium">API key</th>
                  <th className="px-3 py-2 font-medium">Model</th>
                  <th className="px-3 py-2 font-medium">Provider</th>
                  <th className="px-3 py-2 text-right font-medium">Input</th>
                  <th className="px-3 py-2 text-right font-medium">Output</th>
                  <th className="px-3 py-2 text-right font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {logs.map((log) => (
                  <tr key={log.detailId} className="transition-colors hover:bg-primary/5">
                    <td className="whitespace-nowrap px-3 py-2 text-text-muted tabular-nums">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="max-w-[190px] px-3 py-2">
                      <span className="block truncate font-medium text-text-main" title={log.username}>{log.username}</span>
                      {log.email && <span className="block truncate text-[10px] text-text-muted" title={log.email}>{log.email}</span>}
                    </td>
                    <td className="max-w-[150px] truncate px-3 py-2 text-text-muted" title={log.apiKeyName}>{log.apiKeyName}</td>
                    <td className="max-w-[190px] truncate px-3 py-2 font-mono text-text-main" title={log.model}>{log.model}</td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-text-main" title={log.provider}>{log.provider}</td>
                    <td className="px-3 py-2 text-right font-mono text-primary tabular-nums">{NUMBER_FORMAT.format(log.inputTokens || 0)}</td>
                    <td className="px-3 py-2 text-right font-mono text-success tabular-nums">{NUMBER_FORMAT.format(log.outputTokens || 0)}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-warning tabular-nums">{formatCost(log.cost)}</td>
                    <td className={`px-3 py-2 font-medium ${statusClass(log.status)}`}>{log.status}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => viewDetail(log)}
                        disabled={loadingDetailId === log.detailId}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-medium text-text-main transition-colors hover:bg-bg-hover disabled:cursor-wait disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-[15px]">visibility</span>
                        {loadingDetailId === log.detailId ? "Loading" : "Detail"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination
          currentPage={pagination.page}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPage(1);
            setPageSize(value);
          }}
          pageSizeOptions={[10, 30, 50, 100]}
          className="border-t border-border-subtle px-4"
        />
      </Card>

      <RequestDetailDrawer
        detail={selectedDetail}
        isOpen={isDrawerOpen}
        onClose={closeDetail}
        providerName={selectedDetail?.provider}
      />
    </div>
  );
}

RequestLogger.propTypes = {
  period: PropTypes.string,
};
