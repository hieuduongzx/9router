"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/shared/components/ui/icon";

const RATE_FORMAT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

function formatRate(value) {
  return Number.isFinite(Number(value)) ? `$${RATE_FORMAT.format(Number(value))}` : "—";
}

export default function ModelsCatalog() {
  const [models, setModels] = useState([]);
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/catalog/models", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Unable to load models");
        setModels(Array.isArray(data.models) ? data.models : []);
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") setError(reason.message || "Unable to load models");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const providers = useMemo(() => {
    const counts = new Map();
    for (const model of models) {
      const name = String(model.provider || "").trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [models]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return models.filter((model) => {
      if (providerFilter !== "all" && String(model.provider || "").trim() !== providerFilter) {
        return false;
      }
      if (!needle) return true;
      return (
        model.id.toLowerCase().includes(needle) ||
        String(model.provider || "").toLowerCase().includes(needle)
      );
    });
  }, [models, query, providerFilter]);

  const hasFilters = Boolean(query.trim()) || providerFilter !== "all";

  return (
    <section className="relative px-5 pb-20 pt-32 sm:px-6 sm:pb-28 sm:pt-36">
      <div className="mx-auto max-w-7xl">
        <div className="mb-9 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="section-label">Public model catalog</p>
            <h1 className="mt-3 max-w-3xl text-balance font-mono text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Models and pricing, in one place.
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-muted-foreground md:text-lg">
              Browse the routed models published by the administrator and compare per-million-token input and output pricing without signing in.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-muted-foreground">
            <span className="rounded-lg border border-border bg-card px-4 py-2 font-mono">
              {loading ? "…" : models.length} models
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-col gap-4 border-b border-border bg-muted/60 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="size-3 rounded-full bg-destructive" />
              <span className="size-3 rounded-full bg-warning" />
              <span className="size-3 rounded-full bg-success" />
              <span className="ml-2">Models · live pricing table</span>
            </div>
            <label className="relative block w-full max-w-sm">
              <span className="sr-only">Search models</span>
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-[18px] text-muted-foreground" />
              <input
                id="public-model-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search model or provider"
                className="h-10 w-full rounded-md border border-border bg-card pl-10 pr-9 font-mono text-sm text-foreground outline-none transition placeholder:font-sans placeholder:text-muted-foreground focus:border-foreground focus:ring-2 focus:ring-ring/20"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear model search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Icon name="close" className="size-4" />
                </button>
              )}
            </label>
          </div>

          {!loading && providers.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5">
              <button
                type="button"
                onClick={() => setProviderFilter("all")}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  providerFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({models.length})
              </button>
              {providers.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setProviderFilter(p.name)}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    providerFilter === p.name
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.name} ({p.count})
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="p-4">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="mb-2 h-12 animate-pulse rounded-md border border-border bg-muted last:mb-0" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="m-5 rounded-lg border border-warning/30 bg-warning/10 px-5 py-4 text-sm font-medium text-warning">
              {error}
            </div>
          )}

          {!loading && !error && visible.length === 0 && (
            <div className="px-5 py-14 text-center">
              <p className="font-mono text-base font-semibold text-foreground">{hasFilters ? "No matching models" : "No models published yet"}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {hasFilters ? "Try another model name or clear filters." : "An administrator can publish routed models from Model Routes."}
              </p>
            </div>
          )}

          {!loading && !error && visible.length > 0 && (
            <>
              <div className="divide-y divide-border lg:hidden">
                {visible.map((model) => (
                  <article key={`mobile-${model.id}`} className="p-4 sm:p-5">
                    <p className="break-all font-mono text-sm font-semibold leading-6 text-foreground">{model.id}</p>
                    {model.provider && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{model.provider}</p>
                    )}
                    <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/50 p-3">
                      <div>
                        <dt className="text-xs font-medium text-muted-foreground">Input /M</dt>
                        <dd className="mt-1 font-mono text-sm font-semibold text-foreground">{formatRate(model.pricing?.input)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-muted-foreground">Output /M</dt>
                        <dd className="mt-1 font-mono text-sm font-semibold text-foreground">{formatRate(model.pricing?.output)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                  <thead className="thead-data">
                    <tr>
                      <th className="px-5 py-4">Model</th>
                      <th className="px-5 py-4 text-right">Input /M</th>
                      <th className="px-5 py-4 text-right">Output /M</th>
                    </tr>
                  </thead>
                  <tbody className="tbody-data">
                    {visible.map((model) => (
                      <tr key={model.id}>
                        <td className="max-w-[380px] px-5 py-4">
                          <p className="truncate font-mono text-sm font-semibold text-foreground" title={model.id}>{model.id}</p>
                          {model.provider && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{model.provider}</p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-semibold text-foreground">{formatRate(model.pricing?.input)}</td>
                        <td className="px-5 py-4 text-right font-mono font-semibold text-foreground">{formatRate(model.pricing?.output)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
