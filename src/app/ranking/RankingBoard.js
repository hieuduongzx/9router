"use client";

import { useEffect, useState } from "react";

// Public time-frame ladder: hour → day → week → month → all.
const PERIOD_OPTIONS = [
  { value: "1h", label: "Last hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

const SORT_OPTIONS = [
  { value: "requests", label: "Requests" },
  { value: "tokens", label: "Tokens" },
];

const RANK_MEDALS = {
  1: "border-amber-300 bg-amber-50 text-amber-700",
  2: "border-zinc-300 bg-zinc-100 text-zinc-600",
  3: "border-orange-300 bg-orange-50 text-orange-700",
};

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");
const COMPACT_FORMAT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function formatNumber(value) {
  return Number.isFinite(Number(value)) ? NUMBER_FORMAT.format(Number(value)) : "—";
}

function formatCompact(value) {
  return Number.isFinite(Number(value)) ? COMPACT_FORMAT.format(Number(value)) : "—";
}

function formatRelative(timestamp) {
  if (!timestamp) return "—";
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function RankingBoard() {
  const [period, setPeriod] = useState("7d");
  const [sort, setSort] = useState("requests");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Bumping this re-runs the fetch effect — the Refresh button's trigger.
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    const runFetch = () =>
      fetch(`/api/ranking/models?period=${encodeURIComponent(period)}&sort=${encodeURIComponent(sort)}&limit=50`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || "Unable to load ranking");
          setData(payload);
          setError("");
        })
        .catch((reason) => {
          if (!alive || reason?.name === "AbortError") return;
          setError(reason.message || "Unable to load ranking");
        })
        .finally(() => {
          if (alive) setLoading(false);
        });

    runFetch();
    // Leaderboards read well when they breathe on their own — refresh
    // quietly every minute while the tab is open.
    const timer = setInterval(runFetch, 60_000);

    return () => {
      alive = false;
      clearInterval(timer);
      controller.abort();
    };
  }, [period, sort, refreshNonce]);

  const models = Array.isArray(data?.models) ? data.models : [];
  const metric = sort === "tokens" ? "totalTokens" : "requests";
  const leaderValue = models.length > 0 ? Math.max(...models.map((m) => Number(m[metric]) || 0), 1) : 1;

  return (
    <section className="relative px-5 pb-20 pt-32 sm:px-6 sm:pb-28 sm:pt-36">
      <div className="mx-auto max-w-7xl">
        <div className="mb-9 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="section-label">Public model ranking</p>
            <h1 className="mt-3 text-balance font-mono text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl md:text-6xl">
              The most-used models, right now.
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-zinc-600 md:text-lg">
              A live leaderboard of the AI models routed through this gateway, ranked by traffic across the whole system. No sign-in required — aggregate counts only, never individual activity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setRefreshNonce((nonce) => nonce + 1);
              }}
              className="inline-flex h-9 items-center gap-2 border border-zinc-200 bg-white px-4 font-mono text-[13px] font-semibold text-zinc-950 transition-colors hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950"
            >
              <span className={`material-symbols-outlined text-[16px] ${loading ? "animate-spin" : ""}`} aria-hidden="true">refresh</span>
              Refresh
            </button>
          </div>
        </div>

        {/* Window + metric controls */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div role="tablist" aria-label="Time frame" className="flex flex-wrap gap-px border border-zinc-200 bg-zinc-200">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={period === option.value}
                onClick={() => setPeriod(option.value)}
                className={`min-h-10 px-4 font-mono text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 ${
                  period === option.value
                    ? "bg-zinc-950 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Rank by" className="flex gap-px self-start border border-zinc-200 bg-zinc-200 md:self-auto">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={sort === option.value}
                onClick={() => setSort(option.value)}
                className={`min-h-10 px-4 font-mono text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 ${
                  sort === option.value
                    ? "bg-zinc-950 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary tiles */}
        <dl className="mb-8 grid grid-cols-2 gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-3">
          <div className="bg-white p-5">
            <dt className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-400">Total requests</dt>
            <dd className="mt-2 font-mono text-3xl font-semibold tracking-tight text-zinc-950">{formatNumber(data?.totalRequests)}</dd>
          </div>
          <div className="bg-white p-5">
            <dt className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-400">Total tokens</dt>
            <dd className="mt-2 font-mono text-3xl font-semibold tracking-tight text-zinc-950">{formatCompact(data?.totalTokens)}</dd>
          </div>
          <div className="col-span-2 bg-white p-5 sm:col-span-1">
            <dt className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-400">Models tracked</dt>
            <dd className="mt-2 font-mono text-3xl font-semibold tracking-tight text-zinc-950">{formatNumber(models.length)}</dd>
          </div>
        </dl>

        <div className="overflow-hidden border border-zinc-200 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center gap-2 font-mono text-xs text-zinc-500">
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
              <span>{PERIOD_OPTIONS.find((p) => p.value === period)?.label} · ranked by {SORT_OPTIONS.find((s) => s.value === sort)?.label.toLowerCase()}</span>
            </div>
            {data?.generatedAt && (
              <span className="hidden font-mono text-xs text-zinc-400 sm:inline">
                Updated {formatRelative(data.generatedAt)}
              </span>
            )}
          </div>

          {loading && (
            <div className="p-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="mb-2 h-12 animate-pulse border border-zinc-100 bg-zinc-100 last:mb-0" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="m-5 border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900">
              {error}
            </div>
          )}

          {!loading && !error && models.length === 0 && (
            <div className="px-5 py-14 text-center">
              <p className="font-mono text-base font-semibold text-zinc-950">No usage recorded in this window</p>
              <p className="mt-2 text-sm text-zinc-500">
                Traffic routed through the gateway will appear here. Try a wider time frame.
              </p>
            </div>
          )}

          {!loading && !error && models.length > 0 && (
            <>
              {/* Mobile cards */}
              <div className="divide-y divide-zinc-100 md:hidden">
                {models.map((model) => (
                  <article key={`${model.rank}-${model.model}-${model.provider}`} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`inline-flex size-8 shrink-0 items-center justify-center border font-mono text-sm font-bold ${RANK_MEDALS[model.rank] || "border-zinc-200 bg-white text-zinc-500"}`}>
                          {model.rank}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-semibold leading-6 text-zinc-950">{model.model}</p>
                          <p className="truncate text-xs text-zinc-500">{model.provider || "—"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-semibold text-zinc-950">{formatNumber(model[metric])}</p>
                        <p className="text-xs text-zinc-400">{((Number(model[metric]) || 0) / (Number(data.totalRequests) || 1) * 100).toFixed(1)}% share</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead className="bg-white font-mono text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    <tr className="border-b border-zinc-200">
                      <th className="w-16 px-5 py-4">Rank</th>
                      <th className="px-5 py-4">Model</th>
                      <th className="px-5 py-4">Provider</th>
                      <th className="px-5 py-4 text-right">Requests</th>
                      <th className="px-5 py-4 text-right">Tokens</th>
                      <th className="w-[220px] px-5 py-4">Share</th>
                      <th className="px-5 py-4 text-right">Last active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {models.map((model) => {
                      const value = Number(model[metric]) || 0;
                      const total = Number(sort === "tokens" ? data.totalTokens : data.totalRequests) || 1;
                      return (
                        <tr key={`${model.rank}-${model.model}-${model.provider}`} className="bg-white transition hover:bg-zinc-50">
                          <td className="px-5 py-4">
                            <span className={`inline-flex size-8 items-center justify-center border font-mono text-sm font-bold ${RANK_MEDALS[model.rank] || "border-zinc-200 bg-white text-zinc-500"}`}>
                              {model.rank}
                            </span>
                          </td>
                          <td className="max-w-[280px] px-5 py-4">
                            <p className="truncate font-mono text-sm font-semibold text-zinc-950" title={model.model}>{model.model}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="border border-zinc-200 bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-600">{model.provider || "—"}</span>
                          </td>
                          <td className="px-5 py-4 text-right font-mono font-semibold text-zinc-800">{formatNumber(model.requests)}</td>
                          <td className="px-5 py-4 text-right font-mono font-semibold text-zinc-800">{formatCompact(model.totalTokens)}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-full max-w-[140px] bg-zinc-100">
                                <div
                                  className="h-full bg-zinc-950"
                                  style={{ width: `${Math.max(2, Math.round((value / leaderValue) * 100))}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs text-zinc-400">{((value / total) * 100).toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right font-mono text-xs text-zinc-500">{formatRelative(model.lastUsed)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-xs leading-5 text-zinc-400">
          Rankings are aggregates over all gateway traffic. Individual prompts, accounts, and API keys are never shown.
        </p>
      </div>
    </section>
  );
}
