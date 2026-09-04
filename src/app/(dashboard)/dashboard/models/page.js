"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, Input, Select, SegmentedControl, Tooltip } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useShellPath } from "@/shared/hooks/useShellPath";
import LobeProviderIcon from "@/shared/components/LobeProviderIcon";
import { formatRate, isFreePricing } from "@/shared/utils/modelPricing";
import { MODEL_CAPABILITIES as CAPABILITIES } from "@/shared/utils/comboModelConfig";
import { Icon } from "@/shared/components/ui/icon";
const MAX_VISIBLE_CAPS = 3;

const SORT_OPTIONS = [
  { value: "provider:asc", label: "Default (Provider A–Z)" },
  { value: "id:asc", label: "Model A–Z" },
  { value: "context:desc", label: "Context: largest first" },
  { value: "price:asc", label: "Input price: low to high" },
  { value: "price:desc", label: "Input price: high to low" },
  { value: "capabilities:desc", label: "Most capable first" },
];

function formatContextWindow(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `${n % 1_000_000 === 0 ? n / 1_000_000 : (n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

// ── ModelsPage ────────────────────────────────────────────────────
// Read-only catalog. Publishing, thinking defaults, Caps, and pricing live in
// Dashboard / Model Routes, so this page remains the public result preview.

export default function ModelsPage() {
  const [models, setModels] = useState([]);
  const [query, setQuery] = useState("");
  const [providerTab, setProviderTab] = useState("all");
  const [capabilityFilter, setCapabilityFilter] = useState("all");
  const [sort, setSort] = useState({ key: "provider", direction: "asc" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { copied, copy } = useCopyToClipboard();
  const shellPath = useShellPath();
  // Model Routes is /dashboard/combos for a user and /admin/router for an admin.
  const routesHref = shellPath("/dashboard/combos");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/catalog/models?mode=manual", { cache: "no-store", signal: controller.signal })
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

  const providerOptions = useMemo(() => {
    const providersByKey = new Map();
    for (const model of models) {
      const name = String(model.provider || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const current = providersByKey.get(key);
      const iconKey = String(model.providerIcon || "").trim();
      providersByKey.set(key, {
        name: current?.name || name,
        iconKey: current?.iconKey || iconKey,
        count: (current?.count || 0) + 1,
      });
    }
    return [...providersByKey.values()]
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [models]);

  const selectedProvider = (
    providerTab === "all"
    || providerOptions.some((provider) => provider.name === providerTab)
  )
    ? providerTab
    : "all";

  const visibleModels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return models.filter((model) => {
      const matchesQuery = !needle || model.id.toLowerCase().includes(needle);
      const matchesCapability =
        capabilityFilter === "all" || Boolean(model.capabilities?.[capabilityFilter]);
      const matchesProvider = selectedProvider === "all"
        || String(model.provider || "").toLowerCase() === selectedProvider.toLowerCase();
      return matchesQuery && matchesCapability && matchesProvider;
    });
  }, [models, query, capabilityFilter, selectedProvider]);

  const sortedModels = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...visibleModels].sort((a, b) => {
      if (sort.key === "provider") {
        const providerOrder = String(a.provider || "").localeCompare(String(b.provider || ""));
        if (providerOrder !== 0) return providerOrder * direction;
      }
      if (sort.key === "capabilities") {
        const aCount = CAPABILITIES.filter(([key]) => a.capabilities?.[key]).length;
        const bCount = CAPABILITIES.filter(([key]) => b.capabilities?.[key]).length;
        if (aCount !== bCount) return (aCount - bCount) * direction;
      }
      if (sort.key === "context") {
        const aCtx = Number(a.capabilities?.contextWindow) || 0;
        const bCtx = Number(b.capabilities?.contextWindow) || 0;
        if (aCtx !== bCtx) return (aCtx - bCtx) * direction;
      }
      if (sort.key === "price") {
        const aIn = Number(a.pricing?.input);
        const bIn = Number(b.pricing?.input);
        const aVal = Number.isFinite(aIn) ? aIn : Number.POSITIVE_INFINITY;
        const bVal = Number.isFinite(bIn) ? bIn : Number.POSITIVE_INFINITY;
        if (aVal !== bVal) return (aVal - bVal) * direction;
      }
      return a.id.localeCompare(b.id) * direction;
    });
  }, [visibleModels, sort]);

  const toggleSort = (key) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortValue = `${sort.key}:${sort.direction}`;
  const handleSortSelect = (value) => {
    const [key, direction] = value.split(":");
    setSort({ key, direction });
  };
  const filtersActive = Boolean(query.trim()) || capabilityFilter !== "all";

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-8">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        {/* Title lives in the shared Header; only the sub-line stays here. */}
        <p className="max-w-2xl text-sm text-muted-foreground">
          Public API model list. Configure route thinking, Caps, and prices in{" "}
          <Link href={routesHref} className="font-medium text-primary hover:underline">
            Model Routes
          </Link>
          .
        </p>
      </section>

      <SegmentedControl
        size="sm"
        value={selectedProvider}
        onChange={setProviderTab}
        className="w-full justify-start"
        options={[
          {
            value: "all",
            icon: "apps",
            label: (
              <span className="inline-flex items-center gap-1.5">
                <span>All</span>
                <span className="text-muted-foreground">[{models.length}]</span>
              </span>
            ),
          },
          ...providerOptions.map((provider) => ({
            value: provider.name,
            label: (
              <span className="inline-flex items-center gap-1.5">
                <LobeProviderIcon
                  iconKey={provider.iconKey}
                  name={provider.name}
                  className="size-5 border-0 bg-transparent"
                />
                <span>{provider.name}</span>
                <span className="text-muted-foreground">[{provider.count}]</span>
              </span>
            ),
          })),
        ]}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="// search models"
            aria-label="Search available models"
            inputClassName="font-mono"
          />
        </div>
        <Select
          value={capabilityFilter}
          onChange={(event) => setCapabilityFilter(event.target.value)}
          aria-label="Filter models by capability"
          className="w-full sm:w-44"
          options={[
            { value: "all", label: "All capabilities" },
            ...CAPABILITIES.map(([value, label]) => ({ value, label })),
          ]}
        />
        <Select
          value={sortValue}
          onChange={(event) => handleSortSelect(event.target.value)}
          aria-label="Sort models"
          className="w-full sm:w-56"
          options={SORT_OPTIONS}
        />
      </div>

      {filtersActive && (
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
          <span>{visibleModels.length} matches</span>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCapabilityFilter("all");
            }}
            className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            Clear filters
          </button>
        </div>
      )}

      {loading && (
        <div className="h-72 animate-pulse border border-border bg-surface-2" aria-label="Loading available models" />
      )}

      {error && (
        <div role="alert" className="border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {!loading && !error && sortedModels.length > 0 && (
        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-left text-sm">
              <thead className="thead-data">
                <tr className="text-xs font-medium text-muted-foreground tracking-wide text-muted-foreground">
                  <th className="w-[28%] px-3 py-2 font-medium">
                    <button type="button" onClick={() => toggleSort("id")} className="inline-flex items-center gap-1 hover:text-foreground">
                      Model
                      <Icon name={sort.key === "id" ? (sort.direction === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"} className="size-[14px]" />
                    </button>
                  </th>
                  <th className="w-[10%] px-2 py-2 font-medium">
                    <button type="button" onClick={() => toggleSort("context")} className="inline-flex items-center gap-1 hover:text-foreground">
                      Context
                      <Icon name={sort.key === "context" ? (sort.direction === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"} className="size-[14px]" />
                    </button>
                  </th>
                  <th className="w-[13%] px-2 py-2 font-medium" title="USD per one million tokens">
                    <button type="button" onClick={() => toggleSort("price")} className="inline-flex items-center gap-1 hover:text-foreground">
                      Input
                      <Icon name={sort.key === "price" ? (sort.direction === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"} className="size-[14px]" />
                    </button>
                  </th>
                  <th className="w-[13%] px-2 py-2 font-medium" title="USD per one million tokens">Output</th>
                  <th className="w-[12%] px-2 py-2 font-medium" title="USD per one million cached input tokens">Cache read</th>
                  <th className="w-[12%] px-2 py-2 font-medium" title="USD per one million cache-write tokens">Cache write</th>
                  <th className="w-[12%] px-2 py-2 font-medium">Caps</th>
                  <th className="w-[6%] px-2 py-2 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedModels.map((model, index) => {
                  const supported = CAPABILITIES.filter(([key]) => model.capabilities?.[key]);
                  const visibleCaps = supported.slice(0, MAX_VISIBLE_CAPS);
                  const overflowCaps = supported.length - visibleCaps.length;
                  const free = isFreePricing(model.pricing);

                  return (
                    <tr
                      key={model.id}
                      className={`group transition-colors hover:bg-surface-2/60 ${index % 2 === 1 ? "bg-surface-2/30" : ""}`}
                    >
                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex min-w-0 items-center gap-2">
                          <LobeProviderIcon
                            iconKey={model.providerIcon}
                            name={model.provider}
                            className="size-7"
                          />
                          <span className="min-w-0">
                            <code className="block truncate font-mono text-[12px] font-medium text-foreground" title={model.id}>
                              {model.id}
                            </code>
                            <span className="block truncate text-xs font-medium text-muted-foreground tracking-wide text-muted-foreground">
                              {model.provider}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 align-middle font-mono text-xs tabular-nums text-foreground">
                        {formatContextWindow(model.capabilities?.contextWindow)}
                      </td>
                      {["input", "output"].map((field) => (
                        <td key={field} className="px-2 py-2.5 align-middle">
                          {free ? (
                            <span className="font-mono text-xs font-semibold text-success">Free</span>
                          ) : model.pricing ? (
                            <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                              {formatRate(model.pricing[field])}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-2.5 align-middle font-mono text-xs tabular-nums text-muted-foreground">
                        {free ? "Free" : model.pricing ? formatRate(model.pricing.cached) : "—"}
                      </td>
                      <td className="px-2 py-2.5 align-middle font-mono text-xs tabular-nums text-muted-foreground">
                        {free ? "Free" : model.pricing ? formatRate(model.pricing.cache_creation) : "—"}
                      </td>
                      <td className="px-2 py-2.5 align-middle">
                        {supported.length > 0 ? (
                          <div className="flex items-center gap-1">
                            {visibleCaps.map(([key, label, icon]) => (
                              <Tooltip key={key} text={label} position="top">
                                <span
                                  className="inline-flex size-6 items-center justify-center border border-border bg-surface-2 text-foreground"
                                  aria-label={label}
                                >
                                  <Icon name={icon} className="size-[14px]" />
                                </span>
                              </Tooltip>
                            ))}
                            {overflowCaps > 0 && (
                              <Tooltip
                                position="top"
                                text={
                                  <div className="flex flex-col gap-1 text-left">
                                    {supported.map(([key, label, icon]) => (
                                      <div key={key} className="flex items-center gap-1.5 whitespace-nowrap">
                                        <Icon name={icon} className="size-[13px]" />
                                        <span>{label}</span>
                                      </div>
                                    ))}
                                  </div>
                                }
                              >
                                <span className="inline-flex size-6 items-center justify-center border border-border bg-surface-2 font-mono text-[10px] font-semibold text-muted-foreground">
                                  +{overflowCaps}
                                </span>
                              </Tooltip>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right align-middle">
                        <button
                          type="button"
                          onClick={() => copy(model.id, model.id)}
                          className="inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                          aria-label={`Copy model ID ${model.id}`}
                          title="Copy model ID"
                        >
                          <Icon name={copied === model.id ? "check" : "content_copy"} className="size-[16px]" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && !error && sortedModels.length === 0 && (
        <Card className="py-12 text-center">
          <Icon name="deployed_code_off" className="size-9 text-muted-foreground" />
          <h2 className="mt-3 font-mono text-sm font-semibold text-foreground">
            {filtersActive ? "No matching models" : "No models published yet"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            {filtersActive
              ? "Try a shorter model ID or clear the filters."
              : "Enable a route in Model Routes to publish it here."}
          </p>
          {!filtersActive && (
            <Link
              href={routesHref}
              className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs font-medium text-primary hover:underline"
            >
              <Icon name="arrow_forward" className="size-[16px]" />
              Go to Model Routes
            </Link>
          )}
        </Card>
      )}
    </div>
  );
}
