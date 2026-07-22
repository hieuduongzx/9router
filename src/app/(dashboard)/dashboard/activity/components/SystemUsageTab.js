"use client";

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Card from "@/shared/components/Card";

const NUMBER_FORMAT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const MONEY_FORMAT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });

function formatNumber(value) {
  return NUMBER_FORMAT.format(Number(value) || 0);
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function SummaryCard({ icon, label, value, detail, active = false }) {
  return (
    <Card padding="md" className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-muted">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tabular-nums tracking-[-0.03em] text-text-main">{value}</p>
          {detail && <p className="mt-1 text-xs text-text-subtle">{detail}</p>}
        </div>
        <span className={`material-symbols-outlined text-[21px] ${active ? "text-success" : "text-text-subtle"}`}>{icon}</span>
      </div>
    </Card>
  );
}

SummaryCard.propTypes = {
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  detail: PropTypes.string,
  active: PropTypes.bool,
};

export default function SystemUsageTab({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/usage/system?period=${encodeURIComponent(period)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Unable to load system usage");
        setError("");
        setData(body);
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") setError(reason.message || "Unable to load system usage");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [period]);

  if (loading && !data) {
    return (
      <div className="grid gap-3 sm:grid-cols-3" aria-label="Loading system activity">
        {[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-[14px] bg-surface-2" />)}
      </div>
    );
  }

  if (error) {
    return <div role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>;
  }

  const summary = data?.summary || {};
  const users = data?.users || [];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon="sensors"
          label="Active now"
          value={formatNumber(summary.activeRequests)}
          detail="Requests currently in flight"
          active={summary.activeRequests > 0}
        />
        <SummaryCard
          icon="group"
          label="Active users"
          value={formatNumber(summary.activeUsers)}
          detail="Identities with in-flight requests"
          active={summary.activeUsers > 0}
        />
        <SummaryCard
          icon="receipt_long"
          label="Requests"
          value={formatNumber(summary.requests)}
          detail="System-wide in the selected period"
        />
      </div>

      <Card padding="none" className="min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-text-main">Activity by account</h2>
            <p className="mt-0.5 text-xs text-text-muted">Operational traffic attributed through each account-owned API key.</p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-text-muted">{users.length} identities</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-xs">
            <caption className="sr-only">System activity grouped by account for the selected period</caption>
            <thead className="border-b border-border-subtle bg-bg-alt/60 text-text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">User</th>
                <th scope="col" className="px-4 py-3 font-medium">API keys</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Active</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Requests</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Input</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Output</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Cost</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Last request</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {users.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-bg-alt/60">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-text-main">{user.username}</p>
                    {user.email && <p className="mt-0.5 text-[11px] text-text-muted">{user.email}</p>}
                  </td>
                  <td className="max-w-64 px-4 py-3.5 text-text-muted">{user.apiKeys.join(", ") || "—"}</td>
                  <td className="px-4 py-3.5 text-right">
                    {user.activeRequests > 0 ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-success">
                        <span className="size-1.5 rounded-full bg-success" />
                        {user.activeRequests}
                      </span>
                    ) : <span className="text-text-subtle">0</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-text-main">{formatNumber(user.requests)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-text-muted">{formatNumber(user.promptTokens)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-text-muted">{formatNumber(user.completionTokens)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-text-muted">{MONEY_FORMAT.format(Number(user.cost) || 0)}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-text-muted">{formatTime(user.lastRequest)}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-text-muted">No usage recorded for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>


    </div>
  );
}

SystemUsageTab.propTypes = {
  period: PropTypes.string.isRequired,
};
