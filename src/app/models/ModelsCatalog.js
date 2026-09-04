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

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = models.filter((model) => {
      if (!needle) return true;
      return model.id.toLowerCase().includes(needle);
    });
    return filtered;
  }, [models, query]);


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
            <span className="border border-border bg-card px-4 py-2 font-mono">
              {loading ? "…" : models.length} models
            </span>
          </div>
        </div>

        <div className="overflow-hidden border border-border bg-card">
          <div className="flex flex-col gap-4 border-b border-border bg-muted p-4 md:flex-row md:items-center md:justify-between">
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
                placeholder="Search model"
                className="h-11 w-full rounded-sm border border-border bg-card pl-10 pr-3 font-mono text-sm text-foreground outline-none transition placeholder:font-sans placeholder:text-muted-foreground focus:border-foreground focus:ring-1 focus:ring-ring/20"
              />
            </label>
          </div>

          {loading && (
            <div className="p-4">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="mb-2 h-12 animate-pulse border border-border bg-muted last:mb-0" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="m-5 border border-warning/30 bg-warning/10 px-5 py-4 text-sm font-medium text-warning">
              {error}
            </div>
          )}

          {!loading && !error && visible.length === 0 && (
            <div className="px-5 py-14 text-center">
              <p className="font-mono text-base font-semibold text-foreground">{query ? "No matching models" : "No models published yet"}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {query ? "Try another model name." : "An administrator can publish routed models from Dashboard / Models."}
              </p>
            </div>
          )}

          {!loading && !error && visible.length > 0 && (
            <>
              <div className="divide-y divide-border lg:hidden">
                {visible.map((model) => (
                  <article key={`mobile-${model.id}`} className="p-4 sm:p-5">
                    <p className="break-all font-mono text-sm font-semibold leading-6 text-foreground">{model.id}</p>
                    <dl className="mt-4 grid grid-cols-2 gap-3 border border-border bg-muted p-3">
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Input /M</dt>
                        <dd className="mt-1 font-mono text-sm font-semibold text-foreground">{formatRate(model.pricing?.input)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Output /M</dt>
                        <dd className="mt-1 font-mono text-sm font-semibold text-foreground">{formatRate(model.pricing?.output)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                  <thead className="bg-card font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-5 py-4">Model</th>
                      <th className="px-5 py-4 text-right">Input /M</th>
                      <th className="px-5 py-4 text-right">Output /M</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visible.map((model) => (
                      <tr key={model.id} className="bg-card transition hover:bg-muted">
                        <td className="max-w-[320px] px-5 py-4">
                          <p className="truncate font-mono text-sm font-semibold text-foreground">{model.id}</p>
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
