"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select, SegmentedControl, Toggle, Tooltip, Modal } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import LobeProviderIcon from "@/shared/components/LobeProviderIcon";

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
    if (raw === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${label} must be a non-negative number.`);
    }
    pricing[field] = value;
  }
  for (const field of INLINE_FIELDS) {
    if (!Number.isFinite(Number(pricing[field]))) pricing[field] = 0;
  }
  for (const [field] of PRICING_FIELDS) {
    if (!Number.isFinite(Number(pricing[field]))) pricing[field] = 0;
  }
  return pricing;
}

// ── AddModelModal ─────────────────────────────────────────────────

function AddModelModal({ isOpen, onClose, addedIds, onAddModel }) {
  const [availableCombos, setAvailableCombos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [addingId, setAddingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/combos", { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to load combos");
        setAvailableCombos(
          (Array.isArray(data.combos) ? data.combos : [])
            .filter((combo) => !combo.kind || combo.kind === "llm"),
        );
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") {
          setError(reason.message || "Failed to load combos");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [isOpen]);

  const groupedCombos = useMemo(() => {
    const groups = new Map();
    const needle = searchQuery.trim().toLowerCase();

    for (const combo of availableCombos) {
      if (addedIds.has(combo.id)) continue;
      const provider = String(combo.modelProvider || "").trim();
      const matchesSearch = !needle
        || combo.name.toLowerCase().includes(needle)
        || provider.toLowerCase().includes(needle);
      if (!matchesSearch) continue;

      const groupName = provider || "Needs provider";
      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName).push(combo);
    }

    return [...groups.entries()]
      .map(([provider, combos]) => ({
        provider,
        combos: combos.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => {
        if (a.provider === "Needs provider") return 1;
        if (b.provider === "Needs provider") return -1;
        return a.provider.localeCompare(b.provider);
      });
  }, [availableCombos, addedIds, searchQuery]);

  const totalAvailable = useMemo(
    () => groupedCombos.reduce((sum, group) => sum + group.combos.length, 0),
    [groupedCombos],
  );

  const handleAdd = async (combo) => {
    if (addingId) return;
    if (!combo.modelProvider || !Array.isArray(combo.models) || combo.models.length === 0) {
      setError("Edit this combo and set its provider and routed models before publishing.");
      return;
    }

    setAddingId(combo.id);
    setError("");
    try {
      const response = await fetch("/api/models/published", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboId: combo.id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Failed to publish model");
      onAddModel(combo);
    } catch (reason) {
      setError(reason.message || "Failed to publish model");
    } finally {
      setAddingId("");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Model"
      size="md"
      className="p-4!"
      footer={null}
    >
      <p className="mb-3 text-xs leading-5 text-text-muted">
        Publish a routed model from Model Routes. Its route name becomes the API model ID.
      </p>
      <div className="relative mb-3">
        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[16px]">
          search
        </span>
        <input
          type="text"
          placeholder="Search combo or provider..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full rounded-sm border border-border bg-surface py-1.5 pl-8 pr-3 font-mono text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
          autoFocus
        />
      </div>

      {error && (
        <div role="alert" className="mb-3 border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {loading && (
        <div className="h-48 animate-pulse border border-border bg-surface-2" />
      )}

      {!loading && (
        <div className="max-h-[400px] space-y-4 overflow-y-auto">
          {groupedCombos.map((group) => (
            <section key={group.provider}>
              <div className="sticky top-0 mb-1.5 flex items-center gap-1.5 bg-surface py-0.5">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-text-main">
                  {group.provider}
                </span>
                <span className="font-mono text-[10px] text-text-muted">[{group.combos.length}]</span>
              </div>
              <div className="divide-y divide-border border border-border">
                {group.combos.map((combo) => {
                  const memberCount = Array.isArray(combo.models) ? combo.models.length : 0;
                  const ready = Boolean(combo.modelProvider) && memberCount > 0;
                  return (
                    <button
                      key={combo.id}
                      type="button"
                      disabled={Boolean(addingId) || !ready}
                      onClick={() => handleAdd(combo)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <code className="block truncate font-mono text-xs font-semibold text-text-main">
                          {combo.name}
                        </code>
                        <span className="mt-0.5 block text-[11px] text-text-muted">
                          {ready ? `${memberCount} routed model${memberCount === 1 ? "" : "s"}` : "Provider or routed models missing"}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-text-muted">
                        {addingId === combo.id ? "Publishing..." : ready ? "Add" : "Edit combo"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {totalAvailable === 0 && (
            <div className="py-8 text-center text-text-muted">
              <span className="material-symbols-outlined mb-2 block text-3xl">layers_clear</span>
              <p className="text-xs">
                {searchQuery ? "No matching combos found" : "All available combos are already published"}
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── ModelsPage ────────────────────────────────────────────────────

export default function ModelsPage() {
  const [models, setModels] = useState([]);
  const [canEditPricing, setCanEditPricing] = useState(false);
  const [query, setQuery] = useState("");
  const [providerTab, setProviderTab] = useState("all");
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const { copied, copy } = useCopyToClipboard();

  const fetchModels = () => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/catalog/models?mode=manual", { cache: "no-store", signal: controller.signal })
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
  };

  useEffect(() => {
    const cleanup = fetchModels();
    return () => cleanup();
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

  // Published entries reference combos, so combo IDs remain stable across renames.
  const addedIds = useMemo(() => new Set(models.map((model) => model.comboId).filter(Boolean)), [models]);

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

  const handleRemoveModel = async (model) => {
    if (removingId) return;
    setRemovingId(model.id);
    try {
      const res = await fetch(
        `/api/models/published?comboId=${encodeURIComponent(model.comboId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to remove model");
      }
      // Remove from local state
      setModels((current) => current.filter((m) => m.id !== model.id));
    } catch (err) {
      setRowErrors((current) => ({ ...current, [model.id]: err.message || "Failed to remove" }));
    } finally {
      setRemovingId("");
    }
  };

  const handleAddModel = () => {
    // Refresh the models list after adding
    fetchModels();
    setShowAddModal(false);
  };

  const sortValue = `${sort.key}:${sort.direction}`;
  const handleSortSelect = (value) => {
    const [key, direction] = value.split(":");
    setSort({ key, direction });
  };
  const filtersActive = Boolean(query.trim()) || capabilityFilter !== "all";

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-8">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-mono text-lg font-semibold tracking-tight text-text-main">Models</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-text-muted">
            Public API model list. Add model routes, then set pricing per model.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEditPricing && (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon="add"
                onClick={() => setShowAddModal(true)}
              >
                Add Model
              </Button>
              {tableEditMode ? (
                <>
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
                </>
              ) : (
                <Button type="button" variant="outline" size="sm" icon="edit" onClick={enterTableEditMode}>
                  Edit
                </Button>
              )}
            </>
          )}
        </div>
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
                <span className="text-text-subtle">[{models.length}]</span>
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
                <span className="text-text-subtle">[{provider.count}]</span>
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
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-text-muted">
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
                  const busy = savingId === model.id || bulkSaving || removingId === model.id;

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
                            <code className="block truncate font-mono text-[12px] font-medium text-text-main" title={model.id}>
                              {model.id}
                            </code>
                            <span className="block truncate font-mono text-[10px] uppercase tracking-wide text-text-muted">
                              {model.provider}
                            </span>
                          </span>
                          {free && (
                            <span className="shrink-0 rounded-sm bg-text-main px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-bg">
                              Free
                            </span>
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
                          {/* Remove button — only visible in edit mode */}
                          {canEditPricing && tableEditMode && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleRemoveModel(model)}
                              className="inline-flex size-7 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                              title="Remove model from list"
                              aria-label={`Remove ${model.id} from list`}
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {removingId === model.id ? "progress_activity" : "delete"}
                              </span>
                            </button>
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
            {filtersActive ? "No matching models" : "No models added yet"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-text-muted">
            {filtersActive
              ? "Try a shorter model ID or clear the filters."
              : canEditPricing
                ? 'Click "Add Model" to publish a model from Model Routes.'
                : "No models are currently available for routing."}
          </p>
          {canEditPricing && !filtersActive && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon="add"
              className="mt-4"
              onClick={() => setShowAddModal(true)}
            >
              Add Model
            </Button>
          )}
        </Card>
      )}

      {/* Add Model Modal */}
      <AddModelModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        addedIds={addedIds}
        onAddModel={handleAddModel}
      />
    </div>
  );
}
