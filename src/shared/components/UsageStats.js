"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import Card from "./Card";
import OverviewCards from "@/app/(dashboard)/dashboard/usage/components/OverviewCards";
import UsageChart from "@/app/(dashboard)/dashboard/usage/components/UsageChart";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
  { value: "all", label: "All" },
];
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");
const MONEY_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function aggregateModelUsage(byModel) {
  const models = new Map();
  for (const item of Object.values(byModel || {})) {
    const id = item.rawModel || item.model || "Unknown model";
    const current = models.get(id) || {
      id,
      requests: 0,
      promptTokens: 0,
      cachedTokens: 0,
      completionTokens: 0,
      cost: 0,
      lastUsed: null,
    };
    current.requests += Number(item.requests) || 0;
    current.promptTokens += Number(item.promptTokens) || 0;
    current.cachedTokens += Number(item.cachedTokens) || 0;
    current.completionTokens += Number(item.completionTokens) || 0;
    current.cost += Number(item.cost) || 0;
    if (item.lastUsed && (!current.lastUsed || new Date(item.lastUsed) > new Date(current.lastUsed))) {
      current.lastUsed = item.lastUsed;
    }
    models.set(id, current);
  }
  return [...models.values()].sort((a, b) => b.requests - a.requests || a.id.localeCompare(b.id));
}

export default function UsageStats({
  period: periodProp,
  setPeriod: setPeriodProp,
  apiKeyId: apiKeyIdProp = "all",
  hidePeriodSelector = false,
} = {}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [periodLocal, setPeriodLocal] = useState("today");
  const isInitialLoad = useRef(true);
  const period = periodProp ?? periodLocal;
  const setPeriod = setPeriodProp ?? setPeriodLocal;
  const apiKeyId = apiKeyIdProp || "all";

  useEffect(() => {
    const controller = new AbortController();
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      setLoading(true);
    } else {
      setFetching(true);
    }

    const params = new URLSearchParams({ period });
    if (apiKeyId !== "all") params.set("apiKeyId", apiKeyId);
    fetch(`/api/usage/stats?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Unable to load model usage");
        setStats(data);
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") setStats(null);
      })
      .finally(() => {
        setLoading(false);
        setFetching(false);
      });
    return () => controller.abort();
  }, [period, apiKeyId]);

  const models = useMemo(() => aggregateModelUsage(stats?.byModel), [stats]);

  if (!stats && !loading) {
    return <div role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">Model usage could not be loaded.</div>;
  }

  const spinner = (
    <div className="flex items-center justify-center py-12 text-text-muted">
      <span className="material-symbols-outlined animate-spin text-[32px]">progress_activity</span>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {!hidePeriodSelector && (
        <div className="flex w-full items-center gap-2 sm:w-auto sm:self-end">
          <div className="grid flex-1 grid-cols-3 items-center gap-1 rounded-lg border border-border bg-bg-subtle p-1 sm:flex sm:flex-none sm:grid-cols-6">
            {PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPeriod(item.value)}
                disabled={fetching}
                aria-pressed={period === item.value}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                  period === item.value ? "bg-primary text-white shadow-sm" : "text-text-muted hover:bg-bg-hover hover:text-text"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {fetching && <span className="material-symbols-outlined animate-spin text-[16px] text-text-muted">progress_activity</span>}
        </div>
      )}

      {loading ? spinner : <OverviewCards stats={stats} />}

      {loading ? spinner : <UsageChart period={period} apiKeyId={apiKeyId} />}

      <Card padding="none" className="min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-text-main">Usage by model</h2>
            <p className="mt-0.5 text-xs text-text-muted">Duplicate routes are combined so each requested model appears once.</p>
          </div>
          <div className="flex items-center gap-2">
            {fetching && <span className="material-symbols-outlined animate-spin text-[16px] text-text-muted">progress_activity</span>}
            <span className="shrink-0 text-xs tabular-nums text-text-muted">{models.length} models</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <caption className="sr-only">Model usage totals for the selected period and API key scope</caption>
            <thead className="border-b border-border-subtle bg-bg-alt/60 text-text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Model</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Requests</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Input</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Cached</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Output</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Estimated cost</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Last used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {models.map((model) => (
                <tr key={model.id} className="transition-colors hover:bg-bg-alt/60">
                  <td className="max-w-[320px] truncate px-5 py-3.5 font-mono font-medium text-text-main" title={model.id}>{model.id}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-text-main">{NUMBER_FORMAT.format(model.requests)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-text-muted">{NUMBER_FORMAT.format(model.promptTokens)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-text-muted">{NUMBER_FORMAT.format(model.cachedTokens)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-text-muted">{NUMBER_FORMAT.format(model.completionTokens)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-text-muted">{MONEY_FORMAT.format(model.cost)}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-text-muted">{formatTime(model.lastUsed)}</td>
                </tr>
              ))}
              {!loading && models.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-text-muted">No model usage recorded for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

UsageStats.propTypes = {
  period: PropTypes.string,
  setPeriod: PropTypes.func,
  apiKeyId: PropTypes.string,
  hidePeriodSelector: PropTypes.bool,
};
