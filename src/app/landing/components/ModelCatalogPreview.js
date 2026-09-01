"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LobeProviderIcon from "@/shared/components/LobeProviderIcon";
import { Icon } from "@/shared/components/ui/icon";

const RATE_FORMAT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

function formatRate(value) {
  return Number.isFinite(Number(value)) ? `$${RATE_FORMAT.format(Number(value))}` : "—";
}

function formatContext(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "—";
  if (number >= 1_000_000) return `${RATE_FORMAT.format(number / 1_000_000)}M`;
  if (number >= 1_000) return `${RATE_FORMAT.format(number / 1_000)}K`;
  return RATE_FORMAT.format(number);
}

function CapabilityList({ capabilities }) {
  const active = [
    capabilities?.reasoning && "Reasoning",
    capabilities?.tools && "Tools",
    capabilities?.vision && "Vision",
    capabilities?.search && "Search",
  ].filter(Boolean);

  return (
    <span className="font-mono text-xs text-muted-foreground">
      {active.length > 0 ? active.slice(0, 3).join(" · ") : "Text"}
    </span>
  );
}

export default function ModelCatalogPreview() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeProvider, setActiveProvider] = useState("all");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/catalog/models", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Unable to load the published catalog");
        setModels(Array.isArray(data.models) ? data.models : []);
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") {
          setError(reason.message || "Unable to load the published catalog");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const providers = useMemo(() => {
    const byName = new Map();
    models.forEach((model) => {
      const name = String(model.provider || "Other").trim() || "Other";
      if (!byName.has(name)) {
        byName.set(name, { name, iconKey: model.providerIcon || "" });
      }
    });
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [models]);

  const visibleModels = useMemo(() => {
    const filtered = activeProvider === "all"
      ? models
      : models.filter((model) => model.provider === activeProvider);
    return filtered.slice(0, 8);
  }, [activeProvider, models]);

  return (
    <section id="models" className="scroll-mt-16 border-y border-border bg-muted px-5 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-9 max-w-3xl">
          <div className="max-w-3xl">
            <p className="section-label">Live published catalog</p>
            <h2 className="mt-3 text-balance font-mono text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl lg:text-5xl">
              Available models.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Compare providers, capabilities, context limits, and per-million-token pricing before choosing a model.
            </p>
          </div>
        </div>

        <div className="overflow-hidden border border-border bg-white">
          <div className="flex flex-col gap-3 border-b border-border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1 sm:pb-0" aria-label="Filter models by provider">
              <button
                type="button"
                onClick={() => setActiveProvider("all")}
                className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-sm border px-3 font-mono text-xs font-semibold transition-colors ${
                  activeProvider === "all"
                    ? "border-foreground bg-foreground text-white"
                    : "border-border bg-white text-muted-foreground hover:border-foreground/10 hover:text-foreground"
                }`}
              >
                All
                <span className={activeProvider === "all" ? "text-muted-foreground" : "text-muted-foreground"}>{models.length}</span>
              </button>
              {providers.map((provider) => {
                const count = models.filter((model) => model.provider === provider.name).length;
                const active = activeProvider === provider.name;
                return (
                  <button
                    type="button"
                    key={provider.name}
                    onClick={() => setActiveProvider(provider.name)}
                    className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-sm border px-2.5 font-mono text-xs font-semibold transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-white"
                        : "border-border bg-white text-muted-foreground hover:border-foreground/10 hover:text-foreground"
                    }`}
                  >
                    <LobeProviderIcon iconKey={provider.iconKey} name={provider.name} className="size-5 border-0 bg-transparent" />
                    {provider.name}
                    <span className={active ? "text-muted-foreground" : "text-muted-foreground"}>{count}</span>
                  </button>
                );
              })}
            </div>

            <Link href="/models" className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-sm border border-border px-3 font-mono text-xs font-semibold text-foreground transition-colors hover:border-foreground hover:text-foreground">
              Full catalog
              <Icon name="arrow_outward" className="size-[16px]" aria-hidden="true" />
            </Link>
          </div>

          {loading && (
            <div className="p-4" aria-label="Loading model catalog">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="mb-2 h-14 animate-pulse bg-muted last:mb-0" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="m-4 border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              <p className="font-semibold">The published catalog could not be loaded.</p>
              <p className="mt-1">{error}. Refresh the page or try again shortly.</p>
            </div>
          )}

          {!loading && !error && visibleModels.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="font-mono text-sm font-semibold text-foreground">
                {models.length === 0 ? "No models published yet" : "No models for this provider"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {models.length === 0
                  ? "No models are available for purchase yet. Check again shortly."
                  : "Choose All or another provider to continue browsing."}
              </p>
            </div>
          )}

          {!loading && !error && visibleModels.length > 0 && (
            <>
              <div className="divide-y divide-zinc-200 lg:hidden">
                {visibleModels.map((model) => (
                  <article key={`mobile-${model.id}`} className="p-4">
                    <div className="flex items-start gap-3">
                      <LobeProviderIcon iconKey={model.providerIcon} name={model.provider} className="size-8" />
                      <div className="min-w-0">
                        <p className="break-all font-mono text-sm font-semibold text-foreground">{model.id}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{model.provider}</p>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-px border border-border bg-muted">
                      <div className="bg-muted p-3">
                        <dt className="text-xs text-muted-foreground">Context</dt>
                        <dd className="mt-1 font-mono text-xs font-semibold text-foreground">{formatContext(model.capabilities?.contextWindow)}</dd>
                      </div>
                      <div className="bg-muted p-3">
                        <dt className="text-xs text-muted-foreground">Input /M</dt>
                        <dd className="mt-1 font-mono text-xs font-semibold text-foreground">{formatRate(model.pricing?.input)}</dd>
                      </div>
                      <div className="bg-muted p-3">
                        <dt className="text-xs text-muted-foreground">Output /M</dt>
                        <dd className="mt-1 font-mono text-xs font-semibold text-foreground">{formatRate(model.pricing?.output)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[920px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted text-xs font-medium text-muted-foreground">
                      <th className="px-5 py-3">Model</th>
                      <th className="px-5 py-3">Provider</th>
                      <th className="px-5 py-3">Capabilities</th>
                      <th className="px-5 py-3 text-right">Context</th>
                      <th className="px-5 py-3 text-right">Input /M</th>
                      <th className="px-5 py-3 text-right">Output /M</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {visibleModels.map((model) => (
                      <tr key={model.id} className="transition-colors hover:bg-muted">
                        <td className="max-w-[320px] px-5 py-4">
                          <p className="truncate font-mono text-sm font-semibold text-foreground">{model.id}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <LobeProviderIcon iconKey={model.providerIcon} name={model.provider} className="size-7" />
                            <span className="text-sm font-medium text-foreground">{model.provider}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4"><CapabilityList capabilities={model.capabilities} /></td>
                        <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-foreground">
                          {formatContext(model.capabilities?.contextWindow)}
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-foreground">{formatRate(model.pricing?.input)}</td>
                        <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-foreground">{formatRate(model.pricing?.output)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          Pricing is shown per million tokens when configured by the instance administrator.
        </p>
      </div>
    </section>
  );
}
