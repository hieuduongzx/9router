"use client";

import { useEffect, useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { EmptyState, Skeleton } from "@/shared/components";
import { Icon } from "@/shared/components/ui/icon";

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
  1: "border-warning/30/40 bg-warning/10 text-warning dark:border-warning/30 dark:bg-warning/10 dark:text-warning",
  2: "border-foreground/10/40 bg-muted text-muted-foreground dark:border-foreground/15/30 dark:bg-muted-foreground/10 dark:text-muted-foreground",
  3: "border-border/40 bg-muted text-muted-foreground dark:border-border/30 dark:bg-muted/10 dark:text-muted-foreground",
};

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");
const COMPACT_FORMAT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const COST_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

function formatNumber(value) {
  return Number.isFinite(Number(value)) ? NUMBER_FORMAT.format(Number(value)) : "—";
}
function formatCompact(value) {
  return Number.isFinite(Number(value)) ? COMPACT_FORMAT.format(Number(value)) : "—";
}
function formatCost(value) {
  return Number.isFinite(Number(value)) ? COST_FORMAT.format(Number(value)) : "—";
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
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
      fetch(
        `/api/ranking/models?period=${encodeURIComponent(period)}&sort=${encodeURIComponent(sort)}&limit=50`,
        { cache: "no-store", signal: controller.signal },
      )
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
  const leaderValue =
    models.length > 0 ? Math.max(...models.map((m) => Number(m[metric]) || 0), 1) : 1;

  return (
    <section className="bg-background px-5 pb-20 pt-32 sm:px-6 sm:pb-28 sm:pt-36">
      <div className="mx-auto max-w-7xl">
        <div className="mb-9 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-muted-foreground">Public model ranking</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              The most-used models, right now.
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-muted-foreground md:text-lg">
              A live leaderboard of the AI models routed through this gateway, ranked by
              traffic across the whole system. No sign-in required — aggregate counts
              only, never individual activity.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              setRefreshNonce((nonce) => nonce + 1);
            }}
            className="gap-2"
          >
            <Icon
              name="refresh"
              className={loading ? "animate-spin" : ""}
              aria-hidden
            />
            Refresh
          </Button>
        </div>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList aria-label="Time frame">
              {PERIOD_OPTIONS.map((option) => (
                <TabsTrigger key={option.value} value={option.value}>
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Tabs value={sort} onValueChange={setSort}>
            <TabsList aria-label="Rank by">
              {SORT_OPTIONS.map((option) => (
                <TabsTrigger key={option.value} value={option.value}>
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="tile-grid mb-8 grid-cols-2 sm:grid-cols-3">
          <div className="p-5">
            <p className="text-sm text-muted-foreground">Total requests</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
              {formatNumber(data?.totalRequests)}
            </p>
          </div>
          <div className="p-5">
            <p className="text-sm text-muted-foreground">Total tokens</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
              {formatCompact(data?.totalTokens)}
            </p>
          </div>
          <div className="col-span-2 p-5 sm:col-span-1">
            <p className="text-sm text-muted-foreground">Models tracked</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
              {formatNumber(models.length)}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/40" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              <span>
                {PERIOD_OPTIONS.find((p) => p.value === period)?.label} · ranked by{" "}
                {SORT_OPTIONS.find((s) => s.value === sort)?.label.toLowerCase()}
              </span>
            </div>
            {data?.generatedAt ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Updated {formatRelative(data.generatedAt)}
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="p-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="mb-2 h-12 w-full last:mb-0" />
              ))}
            </div>
          ) : null}

          {!loading && error ? (
            <EmptyState
              icon="alert-triangle"
              title="Unable to load ranking"
              description={error}
            />
          ) : null}

          {!loading && !error && models.length === 0 ? (
            <EmptyState
              icon="bar-chart"
              title="No usage recorded in this window"
              description="Traffic routed through the gateway will appear here. Try a wider time frame."
            />
          ) : null}

          {!loading && !error && models.length > 0 ? (
            <>
              <div className="divide-y md:hidden">
                {models.map((model) => (
                  <article
                    key={`${model.rank}-${model.model}`}
                    className="flex items-center justify-between gap-3 p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md border font-mono text-sm font-bold ${
                          RANK_MEDALS[model.rank] ||
                          "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        {model.rank}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{model.model}</p>
                        <p className="truncate text-xs tabular-nums text-success">
                          {formatCost(model.cost)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatNumber(model[metric])}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(
                          (Number(model[metric]) || 0) /
                          (Number(data.totalRequests) || 1) *
                          100
                        ).toFixed(1)}
                        % share
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="w-16 px-5 py-3 font-medium text-muted-foreground">Rank</th>
                      <th className="px-5 py-3 font-medium text-muted-foreground">Model</th>
                      <th className="px-5 py-3 text-right font-medium text-muted-foreground">Cost</th>
                      <th className="px-5 py-3 text-right font-medium text-muted-foreground">Requests</th>
                      <th className="px-5 py-3 text-right font-medium text-muted-foreground">Tokens</th>
                      <th className="w-[220px] px-5 py-3 font-medium text-muted-foreground">Share</th>
                      <th className="px-5 py-3 text-right font-medium text-muted-foreground">Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((model) => {
                      const value = Number(model[metric]) || 0;
                      const total =
                        Number(sort === "tokens" ? data.totalTokens : data.totalRequests) || 1;
                      return (
                        <tr
                          key={`${model.rank}-${model.model}`}
                          className="border-b transition-colors last:border-b-0 hover:bg-muted/40"
                        >
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex size-8 items-center justify-center rounded-md border font-mono text-sm font-bold ${
                                RANK_MEDALS[model.rank] ||
                                "border-border bg-muted text-muted-foreground"
                              }`}
                            >
                              {model.rank}
                            </span>
                          </td>
                          <td className="max-w-[280px] px-5 py-3">
                            <p className="truncate font-semibold" title={model.model}>
                              {model.model}
                            </p>
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums text-success">
                            {formatCost(model.cost)}
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums">
                            {formatNumber(model.requests)}
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums">
                            {formatCompact(model.totalTokens)}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full bg-primary"
                                  style={{
                                    width: `${Math.max(2, Math.round((value / leaderValue) * 100))}%`,
                                  }}
                                />
                              </div>
                              <Badge variant="secondary" className="font-mono text-[11px]">
                                {((value / total) * 100).toFixed(1)}%
                              </Badge>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                            {formatRelative(model.lastUsed)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        <p className="mt-6 text-xs leading-5 text-muted-foreground">
          Rankings are aggregates over all gateway traffic. Individual prompts,
          accounts, and API keys are never shown.
        </p>
      </div>
    </section>
  );
}
