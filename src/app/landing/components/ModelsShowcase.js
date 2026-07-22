"use client";

import { useEffect, useMemo, useState } from "react";

const CAPABILITIES = [
  ["reasoning", "Reasoning"],
  ["vision", "Vision"],
  ["search", "Search"],
  ["tools", "Tools"],
];

const RATE_FORMAT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

function formatRate(value) {
  return Number.isFinite(Number(value)) ? `$${RATE_FORMAT.format(Number(value))}` : "—";
}

function capabilityText(model) {
  const caps = CAPABILITIES.filter(([key]) => model.capabilities?.[key]).map(([, label]) => label);
  return caps.length > 0 ? caps.join(" · ") : "Standard chat";
}

export default function ModelsShowcase() {
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
      return (
        model.id.toLowerCase().includes(needle)
        || String(model.provider || "").toLowerCase().includes(needle)
      );
    });
    return filtered.slice(0, 14);
  }, [models, query]);

  const providers = useMemo(
    () => new Set(models.map((model) => model.provider).filter(Boolean)).size,
    [models],
  );

  return (
    <section id="models" className="relative px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-9 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-black text-blue-600">Every model. One price list.</p>
            <h2 className="mt-3 text-balance text-4xl font-black tracking-[-0.04em] text-zinc-950 md:text-6xl">
              200+ models with side-by-side pricing.
            </h2>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-zinc-600 md:text-lg">
              Compare provider, input price, output price, and capabilities before routing production traffic through Router2k.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-zinc-600">
            <span className="rounded-full border border-blue-100 bg-white px-4 py-2 shadow-sm">
              {loading ? "…" : models.length} models
            </span>
            <span className="rounded-full border border-blue-100 bg-white px-4 py-2 shadow-sm">
              {loading ? "…" : providers} providers
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-2xl shadow-blue-950/8">
          <div className="flex flex-col gap-4 border-b border-zinc-200 bg-zinc-50/80 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
              <span className="size-3 rounded-full bg-red-400" />
              <span className="size-3 rounded-full bg-amber-400" />
              <span className="size-3 rounded-full bg-emerald-400" />
              <span className="ml-2">Models · live pricing table</span>
            </div>
            <label className="relative block w-full max-w-sm">
              <span className="sr-only">Search models</span>
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-zinc-400">search</span>
              <input
                id="landing-model-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search model or provider"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-3 text-sm font-medium text-zinc-950 outline-none transition placeholder:text-zinc-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>
          </div>

          {loading && (
            <div className="p-4">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="mb-2 h-12 animate-pulse rounded-xl bg-zinc-100 last:mb-0" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="m-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900">
              {error}
            </div>
          )}

          {!loading && !error && visible.length === 0 && (
            <div className="px-5 py-14 text-center">
              <p className="text-base font-bold text-zinc-950">No models published yet</p>
              <p className="mt-2 text-sm text-zinc-500">Connect providers in the dashboard to populate this catalog.</p>
            </div>
          )}

          {!loading && !error && visible.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                  <thead className="bg-white text-xs font-black uppercase tracking-wide text-zinc-400">
                    <tr className="border-b border-zinc-200">
                      <th className="px-5 py-4">Model</th>
                      <th className="px-5 py-4">Routed to</th>
                      <th className="px-5 py-4 text-right">Input /M</th>
                      <th className="px-5 py-4 text-right">Output /M</th>
                      <th className="px-5 py-4">Capabilities</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {visible.map((model) => (
                      <tr key={model.id} className="bg-white transition hover:bg-blue-50/50">
                        <td className="max-w-[320px] px-5 py-4">
                          <p className="truncate font-mono text-sm font-black text-zinc-950">{model.id}</p>
                        </td>
                        <td className="px-5 py-4 font-bold text-zinc-600">{model.provider || "—"}</td>
                        <td className="px-5 py-4 text-right font-bold text-zinc-800">{formatRate(model.pricing?.input)}</td>
                        <td className="px-5 py-4 text-right font-bold text-zinc-800">{formatRate(model.pricing?.output)}</td>
                        <td className="px-5 py-4 text-xs font-semibold text-blue-700">{capabilityText(model)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {models.length > visible.length && (
                <p className="border-t border-zinc-200 bg-zinc-50 px-5 py-4 text-center text-sm font-medium text-zinc-500">
                  + {models.length - visible.length} more models · prices update from the live catalog.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
