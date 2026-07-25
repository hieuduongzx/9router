"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select, SegmentedControl, Toggle, Tooltip, Badge } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

const CAPABILITIES = [
  ["reasoning", "Reasoning", "psychology"],
  ["vision", "Vision", "visibility"],
  ["pdf", "PDF input", "description"],
  ["tools", "Tools", "build"],
  ["search", "Web search", "travel_explore"],
  ["audioInput", "Audio input", "mic"],
  ["audioOutput", "Audio output", "volume_up"],
  ["videoInput", "Video input", "videocam"],
  ["imageOutput", "Image output", "image"],
];
const MAX_VISIBLE_CAPS = 3;

const PRICING_FIELDS = [
  ["input", "Input"],
  ["output", "Output"],
  ["cached", "Cached"],
  ["reasoning", "Reasoning"],
  ["cache_creation", "Cache create"],
];

const INLINE_FIELDS = ["input", "output"];

const SORT_OPTIONS = [
  { value: "id:asc", label: "Default (A–Z)" },
  { value: "context:desc", label: "Context: largest first" },
  { value: "price:asc", label: "Input price: low to high" },
  { value: "price:desc", label: "Input price: high to low" },
  { value: "capabilities:desc", label: "Most capable first" },
];

const RATE_FORMAT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

function formatRate(value) {
  return Number.isFinite(Number(value)) ? `$${RATE_FORMAT.format(Number(value))}` : "—";
}

function formatContextWindow(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `${n % 1_000_000 === 0 ? n / 1_000_000 : (n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

/** Prefer server target; synthesize from model id so unpriced rows stay editable. */
function getModelPricingTarget(model) {
  if (model?.pricingTarget?.provider && model?.pricingTarget?.model) {
    return model.pricingTarget;
  }
  const id = String(model?.id || "");
  if (!id || model?.provider === "combo") return null;
  const separator = id.indexOf("/");
  if (separator < 1 || separator === id.length - 1) return null;
  return {
    provider: model.provider || id.slice(0, separator),
    model: id.slice(separator + 1),
  };
}

function isFreePricing(pricing) {
  // No price table / empty object ⇒ gateway bills $0 today. Show Free instead of dashes.
  if (pricing == null || typeof pricing !== "object") return pricing == null;
  const hasAnyRate = PRICING_FIELDS.some(([field]) => {
    const value = pricing[field];
    return value != null && value !== "";
  });
  if (!hasAnyRate) return true;
  return PRICING_FIELDS.every(([field]) => {
    const value = pricing[field];
    if (value == null || value === "") return true;
    return Number(value) === 0;
  });
}

function freePricing() {
  return Object.fromEntries(PRICING_FIELDS.map(([field]) => [field, 0]));
}

function draftFromPricing(pricing = {}) {
  return Object.fromEntries(
    PRICING_FIELDS.map(([field]) => {
      const value = pricing[field];
      return [field, value == null || value === "" ? "" : String(value)];
    }),
  );
}

function draftLooksFree(draft) {
  return isFreePricing(draft || {});
}

function parseDraft(draft, { basePricing = {}, free = false } = {}) {
  if (free) return freePricing();

  const pricing = { ...(basePricing || {}) };
  for (const [field, label] of PRICING_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(draft || {}, field)) continue;
    const raw = String(draft[field] ?? "").trim();
    if (raw === "") {
      // Keep base value when the field is left blank.
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${label} must be a non-negative number.`);
    }
    pricing[field] = value;
  }
  // Ensure required visible rates exist after edit.
  for (const field of INLINE_FIELDS) {
    if (!Number.isFinite(Number(pricing[field]))) pricing[field] = 0;
  }
  // Optional fields default to 0 when absent so API validation always gets numbers.
  for (const [field] of PRICING_FIELDS) {
    if (!Number.isFinite(Number(pricing[field]))) pricing[field] = 0;
  }
  return pricing;
}

export default function ModelsPage() {
  const [models, setModels] = useState([]);
  const [canEditPricing, setCanEditPricing] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [capabilityFilter, setCapabilityFilter] = useState("all");
  const [sort, setSort] = useState({ key: "id", direction: "asc" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tableEditMode, setTableEditMode] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [freeFlags, setFreeFlags] = useState({});
  const [rowErrors, setRowErrors] = useState({});
  const [savingId, setSavingId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
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

  const freeCount = useMemo(() => models.filter((m) => isFreePricing(m.pricing)).length, [models]);

  const tabFilteredModels = useMemo(() => {
    if (tab === "free") return models.filter((m) => isFreePricing(m.pricing));
    return models;
  }, [models, tab]);

  const visibleModels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tabFilteredModels.filter((model) => {
      const matchesQuery = !needle || model.id.toLowerCase().includes(needle);
      const matchesCapability =
        capabilityFilter === "all" || Boolean(model.capabilities?.[capabilityFilter]);
      return matchesQuery && matchesCapability;
    });
  }, [tabFilteredModels, query, capabilityFilter]);

  const sortedModels = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...visibleModels].sort((a, b) => {
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

  const dirtyCount = useMemo(() => {
    if (!tableEditMode) return 0;
    return sortedModels.filter((model) => {
      if (!getModelPricingTarget(model)) return false;
      const draft = drafts[model.id];
      if (!draft && freeFlags[model.id] == null) return false;
      try {
        const free = freeFlags[model.id] === true || draftLooksFree(draft);
        const next = parseDraft(draft || draftFromPricing(model.pricing || {}), {
          basePricing: model.pricing || {},
          free,
        });
        const current = model.pricing || {};
        return PRICING_FIELDS.some(([field]) => Number(current[field] || 0) !== Number(next[field] || 0));
      } catch {
        return true;
      }
    }).length;
  }, [tableEditMode, sortedModels, drafts, freeFlags]);

  const toggleSort = (key) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const enterTableEditMode = () => {
    const nextDrafts = {};
    const nextFlags = {};
    for (const model of models) {
      if (!getModelPricingTarget(model)) continue;
      const pricing = model.pricing;
      const free = isFreePricing(pricing);
      nextDrafts[model.id] = draftFromPricing(free ? freePricing() : (pricing || {}));
      nextFlags[model.id] = free;
    }
    setDrafts(nextDrafts);
    setFreeFlags(nextFlags);
    setRowErrors({});
    setTableEditMode(true);
  };

  const exitTableEditMode = () => {
    if (bulkSaving || savingId) return;
    setTableEditMode(false);
    setDrafts({});
    setFreeFlags({});
    setRowErrors({});
  };

  const clearRowError = (modelId) => {
    setRowErrors((current) => {
      if (!current[modelId]) return current;
      const next = { ...current };
      delete next[modelId];
      return next;
    });
  };

  const updateDraft = (modelId, patch) => {
    setDrafts((current) => {
      const merged = { ...(current[modelId] || {}), ...patch };
      // Typing non-zero rates turns free off automatically.
      if (Object.values(patch).some((value) => Number(value) > 0)) {
        setFreeFlags((flags) => ({ ...flags, [modelId]: false }));
      } else if (draftLooksFree(merged)) {
        setFreeFlags((flags) => ({ ...flags, [modelId]: true }));
      }
      return { ...current, [modelId]: merged };
    });
    clearRowError(modelId);
  };

  const applyPricingLocally = (modelId, pricing, source = "custom") => {
    setModels((current) => current.map((item) => (
      item.id === modelId
        ? { ...item, pricing, pricingSource: source }
        : item
    )));
  };

  const saveModelPricing = async (model, pricing) => {
    const target = getModelPricingTarget(model);
    if (!target) throw new Error("This model cannot be priced.");
    const { provider, model: modelName } = target;
    const response = await fetch("/api/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [provider]: { [modelName]: pricing } }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Unable to save custom price");
    applyPricingLocally(model.id, pricing, "custom");
    setDrafts((current) => ({ ...current, [model.id]: draftFromPricing(pricing) }));
    setFreeFlags((current) => ({ ...current, [model.id]: isFreePricing(pricing) }));
  };

  const resetModelPricing = async (model) => {
    const target = getModelPricingTarget(model);
    if (!target) throw new Error("This model cannot be priced.");
    const { provider, model: modelName } = target;
    const params = new URLSearchParams({ provider, model: modelName });
    const response = await fetch(`/api/pricing?${params}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Unable to restore default price");
    const defaultPricing = model.defaultPricing || null;
    applyPricingLocally(model.id, defaultPricing, defaultPricing ? "default" : "unpriced");
    setDrafts((current) => ({
      ...current,
      [model.id]: draftFromPricing(defaultPricing || {}),
    }));
    setFreeFlags((current) => ({
      ...current,
      [model.id]: isFreePricing(defaultPricing || {}),
    }));
  };

  const resolveRowPricing = (model, draftOverride, freeOverride) => {
    const draft = draftOverride || drafts[model.id] || draftFromPricing(model.pricing || {});
    const free = freeOverride != null
      ? freeOverride
      : (freeFlags[model.id] === true || draftLooksFree(draft));
    return parseDraft(draft, { basePricing: model.pricing || {}, free });
  };

  const handleSaveRow = async (model, options = {}) => {
    setSavingId(model.id);
    clearRowError(model.id);
    try {
      const pricing = resolveRowPricing(model, options.draft, options.free);
      await saveModelPricing(model, pricing);
    } catch (reason) {
      setRowErrors((current) => ({ ...current, [model.id]: reason.message || "Unable to save" }));
    } finally {
      setSavingId("");
    }
  };

  const setModelFree = async (model, free) => {
    const draft = free
      ? draftFromPricing(freePricing())
      : draftFromPricing(model.defaultPricing || model.pricing || {});
    setDrafts((current) => ({ ...current, [model.id]: draft }));
    setFreeFlags((current) => ({ ...current, [model.id]: free }));
    clearRowError(model.id);
    // Persist immediately so toggle "sticks" without a second Save click.
    await handleSaveRow(model, { draft, free });
  };

  const handleSaveAll = async () => {
    setBulkSaving(true);
    const nextErrors = {};
    try {
      for (const model of sortedModels) {
        if (!getModelPricingTarget(model)) continue;
        const draft = drafts[model.id];
        if (!draft && freeFlags[model.id] == null) continue;
        try {
          const pricing = resolveRowPricing(model);
          const current = model.pricing || {};
          const changed = PRICING_FIELDS.some(
            ([field]) => Number(current[field] || 0) !== Number(pricing[field] || 0),
          );
          if (!changed) continue;
          await saveModelPricing(model, pricing);
        } catch (reason) {
          nextErrors[model.id] = reason.message || "Unable to save";
        }
      }
      setRowErrors(nextErrors);
    } finally {
      setBulkSaving(false);
    }
  };

  const sortValue = `${sort.key}:${sort.direction}`;
  const handleSortSelect = (value) => {
    const [key, direction] = value.split(":");
    setSort({ key, direction });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-8">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-mono text-lg font-semibold tracking-tight text-text-main">{"// "}Models</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-text-muted">
            Compact catalog with rates and capability icons. Admins can edit prices inline.
          </p>
        </div>
        {canEditPricing && (
          tableEditMode ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={bulkSaving}
                disabled={bulkSaving || dirtyCount === 0}
                onClick={handleSaveAll}
                icon="save"
              >
                Save all{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={bulkSaving || !!savingId} onClick={exitTableEditMode}>
                Done
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" icon="edit" onClick={enterTableEditMode}>
              Edit prices
            </Button>
          )
        )}
      </section>

      <SegmentedControl
        size="sm"
        value={tab}
        onChange={setTab}
        options={[
          { value: "all", label: `ALL ${models.length}` },
          { value: "free", label: `FREE ${freeCount}` },
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

      {(query || capabilityFilter !== "all" || tab !== "all") && (
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-text-muted">
          <span>{visibleModels.length} matches</span>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCapabilityFilter("all");
              setTab("all");
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
              <thead className="border-b border-border">
                <tr className="font-mono text-[11px] uppercase tracking-wide text-text-muted">
                  <th className="w-[26%] px-3 py-2 font-medium">
                    <button type="button" onClick={() => toggleSort("id")} className="inline-flex items-center gap-1 hover:text-text-main">
                      Model
                      <span className="material-symbols-outlined text-[14px]">
                        {sort.key === "id" ? (sort.direction === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
                      </span>
                    </button>
                  </th>
                  <th className="w-[10%] px-2 py-2 font-medium">
                    <button type="button" onClick={() => toggleSort("context")} className="inline-flex items-center gap-1 hover:text-text-main">
                      Context
                      <span className="material-symbols-outlined text-[14px]">
                        {sort.key === "context" ? (sort.direction === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
                      </span>
                    </button>
                  </th>
                  <th className="w-[13%] px-2 py-2 font-medium" title="USD per one million tokens">
                    <button type="button" onClick={() => toggleSort("price")} className="inline-flex items-center gap-1 hover:text-text-main">
                      Input
                      <span className="material-symbols-outlined text-[14px]">
                        {sort.key === "price" ? (sort.direction === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
                      </span>
                    </button>
                  </th>
                  <th className="w-[13%] px-2 py-2 font-medium" title="USD per one million tokens">Output</th>
                  <th className="w-[12%] px-2 py-2 font-medium" title="USD per one million cached input tokens">Cache read</th>
                  <th className="w-[12%] px-2 py-2 font-medium" title="USD per one million cache-write tokens">Cache write</th>
                  {canEditPricing && tableEditMode && (
                    <th className="w-[8%] px-2 py-2 font-medium">Free</th>
                  )}
                  <th className="w-[10%] px-2 py-2 font-medium">Caps</th>
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
                  const draft = drafts[model.id] || draftFromPricing(model.pricing || {});
                  const free = tableEditMode
                    ? (freeFlags[model.id] === true || draftLooksFree(draft))
                    : isFreePricing(model.pricing);
                  const busy = savingId === model.id || bulkSaving;

                  return (
                    <tr
                      key={model.id}
                      className={`group transition-colors hover:bg-surface-2/60 ${index % 2 === 1 ? "bg-surface-2/30" : ""}`}
                    >
                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex min-w-0 items-center gap-2">
                          <code className="block min-w-0 truncate font-mono text-[12px] font-medium text-text-main" title={model.id}>
                            {model.id}
                          </code>
                          {free && (
                            <span className="shrink-0 rounded-sm bg-text-main px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-bg">
                              Free
                            </span>
                          )}
                          {!free && model.pricingSource === "custom" && (
                            <Badge variant="info" size="sm" className="shrink-0">Custom</Badge>
                          )}
                        </div>
                        {rowErrors[model.id] && (
                          <p className="mt-1 text-[11px] text-danger">{rowErrors[model.id]}</p>
                        )}
                      </td>
                      <td className="px-2 py-2.5 align-middle font-mono text-xs tabular-nums text-text-main">
                        {formatContextWindow(model.capabilities?.contextWindow)}
                      </td>
                      {INLINE_FIELDS.map((field) => (
                        <td key={field} className="px-2 py-2.5 align-middle">
                          {tableEditMode && canEditPricing && getModelPricingTarget(model) ? (
                            <input
                              type="number"
                              min="0"
                              step="0.000001"
                              inputMode="decimal"
                              disabled={busy || free}
                              value={draft[field] ?? ""}
                              onChange={(event) => updateDraft(model.id, { [field]: event.target.value })}
                              className="h-8 w-full rounded-sm border border-border bg-surface px-2 font-mono text-xs text-text-main outline-none focus:border-primary/40 disabled:opacity-60"
                              aria-label={`${field} price for ${model.id}`}
                            />
                          ) : free ? (
                            <span className="font-mono text-xs font-semibold text-success">Free</span>
                          ) : model.pricing ? (
                            <span className="font-mono text-xs font-medium tabular-nums text-text-main">
                              {formatRate(model.pricing[field])}
                            </span>
                          ) : (
                            <span className="text-xs text-text-subtle">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-2.5 align-middle font-mono text-xs tabular-nums text-text-muted">
                        {free ? "Free" : model.pricing ? formatRate(model.pricing.cached) : "—"}
                      </td>
                      <td className="px-2 py-2.5 align-middle font-mono text-xs tabular-nums text-text-muted">
                        {free ? "Free" : model.pricing ? formatRate(model.pricing.cache_creation) : "—"}
                      </td>
                      {canEditPricing && tableEditMode && (
                        <td className="px-2 py-2.5 align-middle">
                          {getModelPricingTarget(model) ? (
                            <Toggle
                              size="sm"
                              checked={free}
                              disabled={busy}
                              onChange={(checked) => setModelFree(model, checked)}
                              aria-label={`Set ${model.id} free`}
                            />
                          ) : (
                            <span className="text-xs text-text-subtle">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-2 py-2.5 align-middle">
                        {supported.length > 0 ? (
                          <div className="flex items-center gap-1">
                            {visibleCaps.map(([key, label, icon]) => (
                              <Tooltip key={key} text={label} position="top">
                                <span
                                  className="inline-flex size-6 items-center justify-center border border-border bg-surface-2 text-text-main"
                                  aria-label={label}
                                >
                                  <span className="material-symbols-outlined text-[14px]">{icon}</span>
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
                                        <span className="material-symbols-outlined text-[13px]">{icon}</span>
                                        <span>{label}</span>
                                      </div>
                                    ))}
                                  </div>
                                }
                              >
                                <span className="inline-flex size-6 items-center justify-center border border-border bg-surface-2 font-mono text-[10px] font-semibold text-text-muted">
                                  +{overflowCaps}
                                </span>
                              </Tooltip>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-text-subtle">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right align-middle">
                        <div className="flex items-center justify-end gap-0.5">
                          {tableEditMode && canEditPricing && getModelPricingTarget(model) && (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleSaveRow(model)}
                                className="inline-flex size-7 items-center justify-center rounded-sm text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                                title="Save row"
                                aria-label={`Save price for ${model.id}`}
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {savingId === model.id ? "progress_activity" : "check"}
                                </span>
                              </button>
                              {model.pricingSource === "custom" && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={async () => {
                                    setSavingId(model.id);
                                    try {
                                      await resetModelPricing(model);
                                    } catch (reason) {
                                      setRowErrors((current) => ({
                                        ...current,
                                        [model.id]: reason.message || "Unable to restore default",
                                      }));
                                    } finally {
                                      setSavingId("");
                                    }
                                  }}
                                  className="inline-flex size-7 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main disabled:opacity-50"
                                  title="Restore default"
                                  aria-label={`Restore default price for ${model.id}`}
                                >
                                  <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                                </button>
                              )}
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => copy(model.id, model.id)}
                            className="inline-flex size-7 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main"
                            aria-label={`Copy model ID ${model.id}`}
                            title="Copy model ID"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {copied === model.id ? "check" : "content_copy"}
                            </span>
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
          <h2 className="mt-3 font-mono text-sm font-semibold text-text-main">
            {query || capabilityFilter !== "all" || tab !== "all" ? "No matching models" : "No models available"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-text-muted">
            {query || capabilityFilter !== "all" || tab !== "all"
              ? "Try a shorter model ID or clear the filters."
              : "No models are currently available for routing."}
          </p>
        </Card>
      )}
    </div>
  );
}
