"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Modal, Select } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

const CAPABILITIES = [
  ["reasoning", "Reasoning", "psychology"],
  ["vision", "Vision", "visibility"],
  ["search", "Search", "travel_explore"],
  ["tools", "Tools", "build"],
];

const PRICING_FIELDS = [
  ["input", "Input", "Standard prompt tokens"],
  ["output", "Output", "Completion and response tokens"],
  ["cached", "Cached input", "Prompt tokens served from cache"],
  ["reasoning", "Reasoning", "Reasoning and thinking tokens"],
  ["cache_creation", "Cache creation", "Tokens used to create a cache entry"],
];

const RATE_FORMAT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

function formatRate(value) {
  return Number.isFinite(value) ? `$${RATE_FORMAT.format(value)}` : "—";
}


export default function ModelsPage() {
  const [models, setModels] = useState([]);
  const [canEditPricing, setCanEditPricing] = useState(false);
  const [query, setQuery] = useState("");
  const [capabilityFilter, setCapabilityFilter] = useState("all");
  const [sort, setSort] = useState({ key: "id", direction: "asc" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingModel, setEditingModel] = useState(null);
  const [pricingDraft, setPricingDraft] = useState({});
  const [pricingError, setPricingError] = useState("");
  const [savingPricing, setSavingPricing] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/catalog/models", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Unable to load models");
        setModels(Array.isArray(data.models) ? data.models : []);
        setCanEditPricing(data.canEditPricing === true);
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") setError(reason.message || "Unable to load models");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const visibleModels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return models.filter((model) => {
      const matchesQuery = !needle || model.id.toLowerCase().includes(needle);
      const matchesCapability =
        capabilityFilter === "all" || Boolean(model.capabilities?.[capabilityFilter]);
      return matchesQuery && matchesCapability;
    });
  }, [models, query, capabilityFilter]);

  const sortedModels = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...visibleModels].sort((a, b) => {
      if (sort.key === "capabilities") {
        const aCount = CAPABILITIES.filter(([key]) => a.capabilities?.[key]).length;
        const bCount = CAPABILITIES.filter(([key]) => b.capabilities?.[key]).length;
        if (aCount !== bCount) return (aCount - bCount) * direction;
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

  const openPricingEditor = (model) => {
    const pricing = model.pricing || {};
    setPricingDraft(Object.fromEntries(
      PRICING_FIELDS.map(([field]) => [field, pricing[field] ?? ""]),
    ));
    setPricingError("");
    setEditingModel(model);
  };

  const closePricingEditor = () => {
    if (savingPricing) return;
    setEditingModel(null);
    setPricingError("");
  };

  const handlePricingSubmit = async (event) => {
    event.preventDefault();
    if (!editingModel?.pricingTarget) return;

    const pricing = {};
    for (const [field, label] of PRICING_FIELDS) {
      const rawValue = String(pricingDraft[field] ?? "").trim();
      const value = Number(rawValue);
      if (rawValue === "" || !Number.isFinite(value) || value < 0) {
        setPricingError(`${label} must be a non-negative number.`);
        return;
      }
      pricing[field] = value;
    }

    setSavingPricing(true);
    setPricingError("");
    try {
      const { provider, model } = editingModel.pricingTarget;
      const response = await fetch("/api/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [provider]: { [model]: pricing } }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to save custom price");

      setModels((current) => current.map((item) => (
        item.id === editingModel.id
          ? { ...item, pricing, pricingSource: "custom" }
          : item
      )));
      setEditingModel(null);
    } catch (reason) {
      setPricingError(reason.message || "Unable to save custom price");
    } finally {
      setSavingPricing(false);
    }
  };

  const handlePricingReset = async () => {
    if (!editingModel?.pricingTarget) return;
    setSavingPricing(true);
    setPricingError("");
    try {
      const { provider, model } = editingModel.pricingTarget;
      const params = new URLSearchParams({ provider, model });
      const response = await fetch(`/api/pricing?${params}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to restore default price");

      const defaultPricing = editingModel.defaultPricing || null;
      setModels((current) => current.map((item) => (
        item.id === editingModel.id
          ? {
              ...item,
              pricing: defaultPricing,
              pricingSource: defaultPricing ? "default" : "unpriced",
            }
          : item
      )));
      setEditingModel(null);
    } catch (reason) {
      setPricingError(reason.message || "Unable to restore default price");
    } finally {
      setSavingPricing(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-8">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-text-main">Available models</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Review model rates, filter capabilities, and copy IDs into API requests.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <div className="w-full sm:w-72">
            <Input
              type="search"
              icon="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search model IDs"
              aria-label="Search available models"
            />
          </div>
          <Select
            value={capabilityFilter}
            onChange={(event) => setCapabilityFilter(event.target.value)}
            aria-label="Filter models by capability"
            className="w-full sm:w-48"
            options={[
              { value: "all", label: "All capabilities" },
              ...CAPABILITIES.map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
        <span className="rounded-full border border-border bg-surface px-2.5 py-1">
          <strong className="font-semibold text-text-main">{models.length}</strong> models
        </span>
        {(query || capabilityFilter !== "all") && (
          <>
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
          </>
        )}
      </div>

      {loading && (
        <div className="h-80 animate-pulse rounded-[14px] bg-surface-2" aria-label="Loading available models" />
      )}

      {error && (
        <div role="alert" className="rounded-[12px] border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {!loading && !error && sortedModels.length > 0 && (
        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[429px] table-fixed text-left md:min-w-[880px]">
              <thead className="border-b border-border-subtle bg-bg-alt/70">
                <tr className="text-xs text-text-muted">
                  <th
                    className="w-[215px] px-5 py-3 font-medium md:w-auto"
                    aria-sort={sort.key === "id" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("id")}
                      className="inline-flex items-center gap-1.5 rounded-sm hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      Model ID
                      <span className="material-symbols-outlined text-[15px]">
                        {sort.key === "id" ? (sort.direction === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
                      </span>
                    </button>
                  </th>
                  <th
                    className="hidden w-80 px-4 py-3 font-medium md:table-cell"
                    aria-sort={sort.key === "capabilities" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("capabilities")}
                      className="inline-flex items-center gap-1.5 rounded-sm hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      Capabilities
                      <span className="material-symbols-outlined text-[15px]">
                        {sort.key === "capabilities" ? (sort.direction === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
                      </span>
                    </button>
                  </th>
                  <th className="w-[150px] px-3 py-3 font-medium md:w-56 md:px-4" title="USD per one million tokens">
                    Price / 1M
                  </th>
                  <th className="w-16 px-2 py-3 text-right font-medium md:w-24 md:px-5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {sortedModels.map((model) => {
                  const supported = CAPABILITIES.filter(([key]) => model.capabilities?.[key]);
                  return (
                    <tr key={model.id} className="group transition-colors hover:bg-bg-alt/70">
                      <td className="px-5 py-3.5">
                        <code className="font-mono text-xs font-medium text-text-main">{model.id}</code>
                      </td>
                      <td className="hidden px-4 py-3.5 md:table-cell">
                        {supported.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {supported.map(([key, label, icon]) => (
                              <span
                                key={key}
                                className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium text-text-muted"
                                title={label}
                              >
                                <span className="material-symbols-outlined text-[11px]">{icon}</span>
                                {label}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-text-subtle">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 md:px-4">
                        {model.pricing ? (
                          <div
                            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                            title={[
                              `Input ${formatRate(model.pricing.input)}`,
                              `Output ${formatRate(model.pricing.output)}`,
                              `Cached ${formatRate(model.pricing.cached)}`,
                              `Reasoning ${formatRate(model.pricing.reasoning)}`,
                              `Cache creation ${formatRate(model.pricing.cache_creation)}`,
                            ].join(" · ")}
                          >
                            <span className="font-mono font-medium text-text-main">
                              {formatRate(model.pricing.input)}
                              <span className="ml-1 font-sans font-normal text-text-subtle">in</span>
                            </span>
                            <span className="font-mono font-medium text-text-main">
                              {formatRate(model.pricing.output)}
                              <span className="ml-1 font-sans font-normal text-text-subtle">out</span>
                            </span>
                            {model.pricingSource === "custom" && (
                              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-wide text-primary">
                                Custom
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-text-subtle">Not priced</span>
                        )}
                      </td>
                      <td className="px-2 py-3.5 text-right md:px-5">
                        <div className="flex items-center justify-end gap-1">
                          {canEditPricing && model.pricingTarget && (
                            <button
                              type="button"
                              onClick={() => openPricingEditor(model)}
                              className="inline-flex size-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                              aria-label={`Edit price for ${model.id}`}
                              title="Edit custom price"
                            >
                              <span className="material-symbols-outlined text-[17px]">edit</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => copy(model.id, model.id)}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            aria-label={`Copy model ID ${model.id}`}
                            title="Copy model ID"
                          >
                            <span className="material-symbols-outlined text-[17px]">{copied === model.id ? "check" : "content_copy"}</span>
                          </button>
                        </div>
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
          <span className="material-symbols-outlined text-4xl text-text-subtle">deployed_code_off</span>
          <h2 className="mt-3 text-sm font-semibold text-text-main">
            {query || capabilityFilter !== "all" ? "No matching models" : "No models available"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-text-muted">
            {query || capabilityFilter !== "all"
              ? "Try a shorter model ID or clear the capability filter."
              : "No models are currently available for routing."}
          </p>
        </Card>
      )}
      <Modal
        isOpen={Boolean(editingModel)}
        onClose={closePricingEditor}
        title="Edit custom model price"
        size="lg"
        closeOnOverlay={!savingPricing}
        footer={
          <>
            {editingModel?.pricingSource === "custom" && (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto"
                disabled={savingPricing}
                onClick={handlePricingReset}
              >
                Restore default
              </Button>
            )}
            <Button type="button" variant="ghost" disabled={savingPricing} onClick={closePricingEditor}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="model-pricing-form"
              loading={savingPricing}
              icon="save"
            >
              Save price
            </Button>
          </>
        }
      >
        <form id="model-pricing-form" onSubmit={handlePricingSubmit} className="space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Model</p>
            <code className="mt-1 block break-all font-mono text-sm font-medium text-text-main">
              {editingModel?.id}
            </code>
          </div>

          <div className="rounded-lg border border-border bg-bg-subtle px-3.5 py-3 text-xs text-text-muted">
            Rates are USD per one million tokens. Saving creates an administrator override used by request cost tracking.
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PRICING_FIELDS.map(([field, label, hint]) => (
              <Input
                key={field}
                type="number"
                min="0"
                step="0.000001"
                inputMode="decimal"
                label={label}
                value={pricingDraft[field] ?? ""}
                onChange={(event) => {
                  setPricingDraft((current) => ({ ...current, [field]: event.target.value }));
                  setPricingError("");
                }}
                hint={`${hint} ($/1M)`}
                required
              />
            ))}
          </div>

          {pricingError && (
            <div role="alert" className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
              {pricingError}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
