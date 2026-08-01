"use client";

import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import Card from "./Card";
import CursorPagination from "./CursorPagination";
import RequestDetailDrawer, { useRequestDetailDrawer } from "./RequestDetailDrawer";
import StatusPill from "./StatusPill";

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

export default function RequestLogger({ period = "all" }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
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
          <h2 className="font-mono text-lg font-semibold text-text-main">Request Logs</h2>
          <p className="mt-0.5 text-xs text-text-muted">Account ownership is resolved from the API key used for each request.</p>
        </div>
        <button
          type="button"
          onClick={() => setAutoRefresh((value) => !value)}
          aria-pressed={autoRefresh}
          className="inline-flex items-center gap-2 self-start font-mono text-xs font-medium text-text-muted sm:self-auto"
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
      </div>

      {detailError && (
        <div className="rounded-sm border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
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
            <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-border font-mono text-text-muted">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 font-semibold uppercase tracking-wide">Time</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-semibold uppercase tracking-wide">Account</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-semibold uppercase tracking-wide">Total Cost</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-semibold uppercase tracking-wide">Input Tokens</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-semibold uppercase tracking-wide">Output Tokens</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-semibold uppercase tracking-wide">Timing</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-semibold uppercase tracking-wide">Model</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-semibold uppercase tracking-wide">Mode</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-semibold uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr
                    key={log.detailId}
                    onClick={() => viewDetail(log)}
                    className={`cursor-pointer transition-colors hover:bg-surface-2/70 ${
                      loadingDetailId === log.detailId ? "opacity-60" : ""
                    } ${index % 2 === 1 ? "bg-surface-2/30" : ""}`}
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-text-muted tabular-nums">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="max-w-[190px] px-4 py-2.5">
                      <span className="block truncate font-medium text-text-main" title={log.username}>{log.username}</span>
                      {log.email && <span className="block truncate text-[10px] text-text-muted" title={log.email}>{log.email}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono font-medium tabular-nums text-text-main">{formatCost(log.cost)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono tabular-nums text-text-main">{NUMBER_FORMAT.format(log.inputTokens || 0)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono tabular-nums text-text-main">{NUMBER_FORMAT.format(log.outputTokens || 0)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono tabular-nums text-text-muted">{formatTiming(log.timingMs)}</td>
                    <td className="max-w-[190px] truncate px-4 py-2.5 font-mono text-text-main" title={log.model}>{log.model}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-text-muted">{log.mode || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5"><StatusPill status={log.status} /></td>
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
        providerName={selectedDetail?.provider}
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
};
