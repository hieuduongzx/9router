"use client";

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Card from "@/shared/components/Card";
import StatTile from "@/shared/components/StatTile";
import SectionLabel from "@/shared/components/SectionLabel";
import UsageOverTime from "@/app/(dashboard)/dashboard/usage/components/UsageOverTime";

const NUMBER_FORMAT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const MONEY_FORMAT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });

function formatNumber(value) {
  return NUMBER_FORMAT.format(Number(value) || 0);
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

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
        {[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse bg-surface-2" />)}
      </div>
    );
  }

  if (error) {
    return <div role="alert" className="border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>;
  }

  const summary = data?.summary || {};
  const users = data?.users || [];
  const totalTokens = (Number(summary.promptTokens) || 0) + (Number(summary.completionTokens) || 0);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section aria-label="System usage summary">
        <SectionLabel className="mb-3">Usage summary</SectionLabel>
        <div className="tile-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          <StatTile
            chip="requests"
            label="Requests"
            value={formatNumber(summary.requests)}
            sub="Completed and failed requests in this period"
          />
          <StatTile
            chip="tokens"
            label="Total tokens"
            value={formatNumber(totalTokens)}
            sub="Input and output tokens combined"
          />
          <StatTile
            chip="cost"
            label="Estimated cost"
            value={MONEY_FORMAT.format(Number(summary.cost) || 0)}
            sub="Calculated from recorded model pricing"
          />
          <StatTile
            chip="tokens"
            label="Input tokens"
            value={formatNumber(summary.promptTokens)}
            sub="Prompt and context tokens sent upstream"
          />
          <StatTile
            chip="tokens"
            label="Output tokens"
            value={formatNumber(summary.completionTokens)}
            sub="Completion and reasoning tokens returned"
          />
          <StatTile
            chip="info"
            label="Active now"
            value={formatNumber(summary.activeRequests)}
            sub={`${formatNumber(summary.activeUsers)} active ${Number(summary.activeUsers) === 1 ? "identity" : "identities"}`}
          />
        </div>
      </section>

      <UsageOverTime period={period} scope="system" title="System usage over time" />

      <Card padding="none" className="min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div>
            <h2 className="font-mono text-sm font-semibold text-text-main">Activity by account</h2>
            <p className="mt-0.5 text-xs text-text-muted">Operational traffic attributed through each account-owned API key.</p>
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">{users.length} identities</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-xs">
            <caption className="sr-only">System activity grouped by account for the selected period</caption>
            <thead className="thead-data">
              <tr>
                <th scope="col" className="px-5 py-3 font-mono font-medium">User</th>
                <th scope="col" className="px-4 py-3 font-mono font-medium">API keys</th>
                <th scope="col" className="px-4 py-3 text-right font-mono font-medium">Active</th>
                <th scope="col" className="px-4 py-3 text-right font-mono font-medium">Requests</th>
                <th scope="col" className="px-4 py-3 text-right font-mono font-medium">Input tokens</th>
                <th scope="col" className="px-4 py-3 text-right font-mono font-medium">Output tokens</th>
                <th scope="col" className="px-4 py-3 text-right font-mono font-medium">Total tokens</th>
                <th scope="col" className="px-4 py-3 text-right font-mono font-medium">Cost</th>
                <th scope="col" className="px-5 py-3 text-right font-mono font-medium">Last request</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {users.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-bg-alt/60">
                  <td className="px-5 py-3.5">
                    <p className="font-mono font-medium text-text-main">{user.username}</p>
                    {user.email && <p className="mt-0.5 font-mono text-[11px] text-text-muted">{user.email}</p>}
                  </td>
                  <td className="max-w-64 px-4 py-3.5 font-mono text-text-muted">{user.apiKeys.join(", ") || "—"}</td>
                  <td className="px-4 py-3.5 text-right">
                    {user.activeRequests > 0 ? (
                      <span className="inline-flex items-center gap-1.5 font-mono font-semibold tabular-nums text-success">
                        <span className="size-1.5 bg-success" />
                        {user.activeRequests}
                      </span>
                    ) : <span className="font-mono text-text-subtle">0</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-text-main">{formatNumber(user.requests)}</td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-text-muted">{formatNumber(user.promptTokens)}</td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-text-muted">{formatNumber(user.completionTokens)}</td>
                  <td className="px-4 py-3.5 text-right font-mono font-medium tabular-nums text-text-main">
                    {formatNumber((Number(user.promptTokens) || 0) + (Number(user.completionTokens) || 0))}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-text-muted">{MONEY_FORMAT.format(Number(user.cost) || 0)}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono text-text-muted">{formatTime(user.lastRequest)}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-text-muted">No usage recorded for this period.</td></tr>
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
