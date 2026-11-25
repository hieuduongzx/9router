"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import RouteEditorModal, { TestStateMark } from "./RouteEditorModal";
import { notify } from "@/store/notificationStore";
import { Card, Button, Modal, Input, CardSkeleton, ModelSelectModal, ConfirmModal, Select, SegmentedControl, Toggle, CapacityBadges, SmartPolicyModal } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useModelCaps } from "@/shared/hooks/useModelCaps";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider, resolveProviderId, AI_PROVIDERS } from "@/shared/constants/providers";
import LobeProviderIcon from "@/shared/components/LobeProviderIcon";
import { normalizeLobeIconKey } from "@/shared/utils/lobeIcons";
import {
  PRICING_FIELDS,
  draftFromPricing,
  draftLooksFree,
  formatRate,
  freePricing,
  isFreePricing,
  parseDraft,
} from "@/shared/utils/modelPricing";
import {
  MODEL_CAPABILITIES,
  deriveComboCapabilities,
  getComboThinkingProfile,
  getEffectiveComboCapabilities,
  normalizeCapabilityOverrides,
  thinkingModeMeta,
} from "@/shared/utils/comboModelConfig";
import { comboRoutedModels, normalizeDisabledMembers } from "open-sse/services/comboMembers.js";
import { comboPricingTarget } from "@/lib/publishedModelsCatalog";
import { DEFAULT_SYSTEMONE_ROUTER_MODEL } from "open-sse/services/systemoneRouter.js";
import { Icon } from "@/shared/components/ui/icon";

// Validate combo name: only a-z, A-Z, 0-9, -, _
const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

// Capacity adapter: global fallback pools of models per input-modality capability.
// A request needing a capability the target model/combo lacks switches straight
// to the first enabled model here instead of erroring or dropping the data.
const CAPACITY_ADAPTER_CAPS = [
  { key: "vision", label: "Vision", icon: "visibility", desc: "Images" },
  // pdf, videoInput temporarily hidden — no translator support yet for those blocks.
  { key: "audioInput", label: "Audio", icon: "graphic_eq", desc: "Audio input" },
];
const DEFAULT_FALLBACK_MODEL = "oc/mimo-v2.6-flash-free";
const upgradeLegacyModel = (model) => (model === "oc/mimo-v2.5-free" ? DEFAULT_FALLBACK_MODEL : model);
const EMPTY_CAP_ENTRY = { enabled: true, roundRobin: false, models: [] };
const EMPTY_CAPACITY_ADAPTER = {
  vision: { ...EMPTY_CAP_ENTRY },
  pdf: { ...EMPTY_CAP_ENTRY },
  audioInput: { ...EMPTY_CAP_ENTRY },
  videoInput: { ...EMPTY_CAP_ENTRY },
};
// Backward-compat: legacy stored form was an array of {model, enabled}.
function normalizeCapEntry(entry) {
  if (Array.isArray(entry)) {
    return { enabled: true, roundRobin: false, models: entry.map((e) => upgradeLegacyModel(e?.model || e)).filter(Boolean) };
  }
  if (entry && typeof entry === "object") {
    return {
      enabled: entry.enabled !== false,
      roundRobin: !!entry.roundRobin,
      models: Array.isArray(entry.models) ? entry.models.map(upgradeLegacyModel).filter(Boolean) : [],
    };
  }
  return { ...EMPTY_CAP_ENTRY };
}

export default function CombosPage() {
  const [combos, setCombos] = useState([]);
  const [activeTab, setActiveTab] = useState("routes");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState(null);
  const [editingInitialTab, setEditingInitialTab] = useState("models");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [inlineUpdatingId, setInlineUpdatingId] = useState("");
  const [judgeCombo, setJudgeCombo] = useState(null);
  const [routerCombo, setRouterCombo] = useState(null);
  const [policyCombo, setPolicyCombo] = useState(null);
  const [activeProviders, setActiveProviders] = useState([]);
  const [modelProviders, setModelProviders] = useState([]);
  const [comboStrategies, setComboStrategies] = useState({});
  const [comboTests, setComboTests] = useState({});
  const [capacityAdapter, setCapacityAdapter] = useState(EMPTY_CAPACITY_ADAPTER);
  const { getCaps } = useModelCaps();
  const [confirmState, setConfirmState] = useState(null);
  // Enabled route = published model. Same store as Dashboard / Models.
  const [publishedIds, setPublishedIds] = useState(() => new Set());
  const [publishingId, setPublishingId] = useState("");
  const [publishError, setPublishError] = useState("");
  // Public prices are set here — a route's rates are keyed by its owner
  // provider plus its public name, the same key /v1 bills against.
  const [canEditPricing, setCanEditPricing] = useState(false);
  const [pricingCombo, setPricingCombo] = useState(null);
  const [sortBy, setSortBy] = useState("provider");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  const fetchData = async () => {
    try {
      const [combosRes, providersRes, settingsRes, modelProvidersRes, publishedRes] = await Promise.all([
        fetch("/api/combos"),
        fetch("/api/providers"),
        fetch("/api/settings"),
        fetch("/api/models/providers"),
        fetch("/api/models/published"),
      ]);
      const combosData = await combosRes.json();
      const providersData = await providersRes.json();
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};
      const modelProvidersData = modelProvidersRes.ok ? await modelProvidersRes.json() : {};
      if (publishedRes.ok) {
        const publishedData = await publishedRes.json();
        setPublishedIds(new Set((publishedData.models || []).map((model) => model.comboId)));
      }

      // Only LLM combos here - webSearch/webFetch combos belong to media-providers/web
      if (combosRes.ok) {
        setCombos((combosData.combos || []).filter(c => !c.kind || c.kind === "llm"));
        setCanEditPricing(combosData.canEditPricing === true);
      }
      if (providersRes.ok) {
        setActiveProviders((providersData.connections || []).filter((c) => c.isActive !== false));
      }
      if (modelProvidersRes.ok) setModelProviders(modelProvidersData.providers || []);
      setComboStrategies(settingsData.comboStrategies || {});
      const rawAdapter = settingsData.capacityAdapter || {};
      const normalized = {};
      for (const cap of CAPACITY_ADAPTER_CAPS) {
        normalized[cap.key] = normalizeCapEntry(rawAdapter[cap.key]);
      }
      setCapacityAdapter(normalized);
    } catch (error) {
      console.log("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Mount load. fetchData sets state after the network response, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const handleSetCapacityAdapter = async (next) => {
    setCapacityAdapter(next);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capacityAdapter: next }),
      });
    } catch (error) {
      console.log("Error updating capacity adapter:", error);
    }
  };

  /**
   * Persist the price the route form collected, keyed by the route as it was
   * just saved. `request` is null when the form had nothing to write (viewer
   * cannot price, or the draft is unchanged).
   */
  const writeRoutePricing = async (savedCombo, request) => {
    if (!request) return;
    const target = comboPricingTarget(savedCombo);

    // A rename or owner change moves the key, so the stale entry is dropped
    // first — otherwise the old name keeps billing at the old rate.
    const staleTargets = [];
    if (request.previousTarget) staleTargets.push(request.previousTarget);
    if (request.mode === "reset" && target) staleTargets.push(target);
    for (const stale of staleTargets) {
      const params = new URLSearchParams({ provider: stale.provider, model: stale.model });
      const response = await fetch(`/api/pricing?${params}`, { method: "DELETE" });
      if (!response.ok && request.mode === "reset") {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Unable to restore default price");
      }
    }

    if (request.mode === "reset" || !target) return;

    const response = await fetch("/api/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [target.provider]: { [target.model]: request.pricing } }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Unable to save price");
    }
  };

  const handleCreate = async (data, pricingRequest) => {
    const res = await fetch("/api/combos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to create combo");
    }
    // A new route starts enabled when it already has an owner and at least
    // one enabled member, so creating one makes it immediately routable.
    const created = await res.json().catch(() => null);
    // The price is keyed by the saved name + owner, so it is written after the
    // route exists — a failure here must not hide the route that was created.
    await writeRoutePricing(created, pricingRequest);
    if (created?.id && created.modelProvider && comboRoutedModels(created).length > 0) {
      await handleTogglePublished(created, true);
    }
    await fetchData();
    setShowCreateModal(false);
  };

  const handleUpdate = async (id, data, pricingRequest) => {
    const res = await fetch(`/api/combos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to update combo");
    }
    const updated = await res.json().catch(() => null);
    // Renaming a route or changing its owner moves the pricing key, so the write
    // uses the saved record rather than the values the form started with.
    await writeRoutePricing(updated || { ...data, id }, pricingRequest);
    await fetchData();
    setComboTests((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setEditingCombo(null);
  };

  const handleDelete = async (id) => {
    setConfirmState({
      title: "Delete Combo",
      message: "Delete this combo?",
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/combos/${id}`, { method: "DELETE" });
          if (res.ok) {
            setCombos(combos.filter(c => c.id !== id));
            setComboTests((current) => {
              const next = { ...current };
              delete next[id];
              return next;
            });
          }
        } catch (error) {
          console.log("Error deleting combo:", error);
        }
      }
    });
  };

  // Enabling a route publishes it: it shows up in Dashboard / Models, is served
  // from /v1/models, and becomes routable. Disabling removes it everywhere.
  const handleTogglePublished = async (combo, enabled) => {
    setPublishingId(combo.id);
    setPublishError("");
    setPublishedIds((current) => {
      const next = new Set(current);
      if (enabled) next.add(combo.id);
      else next.delete(combo.id);
      return next;
    });

    try {
      const response = enabled
        ? await fetch("/api/models/published", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ comboId: combo.id }),
          })
        : await fetch(`/api/models/published?comboId=${encodeURIComponent(combo.id)}`, { method: "DELETE" });

      // 409 = already published: the desired end state, not a failure.
      if (!response.ok && !(enabled && response.status === 409)) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || (enabled ? "Failed to enable route" : "Failed to disable route"));
      }
    } catch (error) {
      setPublishedIds((current) => {
        const next = new Set(current);
        if (enabled) next.delete(combo.id);
        else next.add(combo.id);
        return next;
      });
      setPublishError(error.message || "Failed to update route");
    } finally {
      setPublishingId("");
    }
  };

  // Reflect a pricing write locally so the table updates without a full refetch.
  const applyPricingLocally = (comboId, pricing, source) => {
    setCombos((current) => current.map((item) => (
      item.id === comboId ? { ...item, pricing, pricingSource: source } : item
    )));
    setPricingCombo((current) => (
      current?.id === comboId ? { ...current, pricing, pricingSource: source } : current
    ));
  };

  const handleSavePricing = async (combo, pricing) => {
    const target = combo.pricingTarget;
    if (!target) throw new Error("Set a model provider before pricing this route.");
    const response = await fetch("/api/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [target.provider]: { [target.model]: pricing } }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Unable to save price");
    applyPricingLocally(combo.id, pricing, "custom");
  };

  const handleResetPricing = async (combo) => {
    const target = combo.pricingTarget;
    if (!target) throw new Error("Set a model provider before pricing this route.");
    const params = new URLSearchParams({ provider: target.provider, model: target.model });
    const response = await fetch(`/api/pricing?${params}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Unable to restore default price");
    const defaultPricing = combo.defaultPricing || null;
    applyPricingLocally(combo.id, defaultPricing, defaultPricing ? "default" : "unpriced");
  };

  // Merge a per-combo strategy patch into settings.comboStrategies. Passing an empty
  // patch (strategy back to default "fallback") drops the entry entirely.
  const handleSetComboStrategy = async (comboName, patch) => {
    try {
      const updated = { ...comboStrategies };
      const next = { ...(updated[comboName] || {}), ...patch };
      // Prune to keep settings clean: default fallback with no extras = no entry.
      if (!next.fallbackStrategy || next.fallbackStrategy === "fallback") {
        delete updated[comboName];
      } else {
        updated[comboName] = next;
      }

      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboStrategies: updated }),
      });

      setComboStrategies(updated);
    } catch (error) {
      console.log("Error updating combo strategy:", error);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const ids = combos.filter((combo) => selectedIds.includes(combo.id)).map((combo) => combo.id);
    const count = ids.length;
    setConfirmState({
      title: "Delete selected routes",
      message: `Delete ${count} selected route${count === 1 ? "" : "s"}? This cannot be undone.`,
      onConfirm: async () => {
        setBulkBusy(true);
        setConfirmState(null);
        try {
          const results = await Promise.all(ids.map((id) => fetch(`/api/combos/${id}`, { method: "DELETE" })));
          const removed = new Set(ids.filter((id, index) => results[index].ok));
          setCombos((current) => current.filter((combo) => !removed.has(combo.id)));
          setComboTests((current) => {
            const next = { ...current };
            for (const id of removed) delete next[id];
            return next;
          });
          setSelectedIds((current) => current.filter((id) => !removed.has(id)));
          const failed = results.filter((result) => !result.ok).length;
          if (failed > 0) setPublishError(`Deleted with ${failed} failure${failed === 1 ? "" : "s"}.`);
        } catch (error) {
          console.log("Error bulk deleting routes:", error);
          setPublishError("Failed to delete the selected routes.");
        } finally {
          setBulkBusy(false);
        }
      },
    });
  };

  const handleInlineThinkingChange = async (combo, nextMode) => {
    const previous = combo.thinkingMode || "auto";
    if (previous === nextMode) return;
    setInlineUpdatingId(combo.id);
    setCombos((current) =>
      current.map((item) => (item.id === combo.id ? { ...item, thinkingMode: nextMode } : item)),
    );
    try {
      const res = await fetch(`/api/combos/${combo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: combo.name,
          models: combo.models,
          modelProvider: combo.modelProvider,
          thinkingMode: nextMode,
          capabilityOverrides: combo.capabilityOverrides || {},
          disabledMembers: combo.disabledMembers || [],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update thinking mode");
      }
      notify.success(`Thinking set to ${thinkingModeMeta(nextMode).label} for ${combo.name}`);
    } catch (error) {
      setCombos((current) =>
        current.map((item) => (item.id === combo.id ? { ...item, thinkingMode: previous } : item)),
      );
      notify.error(error?.message || "Failed to update thinking mode");
    } finally {
      setInlineUpdatingId("");
    }
  };

  const handleBulkTogglePublished = async (enabled) => {
    const chosen = combos.filter((combo) => selectedIds.includes(combo.id));
    if (chosen.length === 0) return;
    const targets = enabled
      ? chosen.filter((combo) => !publishedIds.has(combo.id) && Boolean(String(combo.modelProvider || "").trim()) && comboRoutedModels(combo).length > 0)
      : chosen.filter((combo) => publishedIds.has(combo.id));
    if (targets.length === 0) {
      notify.info(enabled ? "Selected routes are already enabled or missing provider/models." : "Selected routes are already disabled.");
      return;
    }
    setBulkBusy(true);
    setPublishError("");
    try {
      const results = await Promise.all(
        targets.map((combo) =>
          enabled
            ? fetch("/api/models/published", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ comboId: combo.id }),
              })
            : fetch(`/api/models/published?comboId=${encodeURIComponent(combo.id)}`, { method: "DELETE" }),
        ),
      );
      setPublishedIds((current) => {
        const next = new Set(current);
        targets.forEach((combo, idx) => {
          if (results[idx].ok || (enabled && results[idx].status === 409)) {
            if (enabled) next.add(combo.id);
            else next.delete(combo.id);
          }
        });
        return next;
      });
      const succeeded = results.filter((r) => r.ok || (enabled && r.status === 409)).length;
      if (succeeded > 0) notify.success(`${enabled ? "Enabled" : "Disabled"} ${succeeded} route${succeeded === 1 ? "" : "s"}`);
    } catch (error) {
      setPublishError(error?.message || "Failed to update selected routes.");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkSetStrategy = async (strategy) => {
    const chosen = combos.filter((combo) => selectedIds.includes(combo.id));
    if (chosen.length === 0 || !strategy) return;
    setBulkBusy(true);
    try {
      const updated = { ...comboStrategies };
      for (const combo of chosen) {
        if (strategy === "fallback") delete updated[combo.name];
        else updated[combo.name] = { ...(updated[combo.name] || {}), fallbackStrategy: strategy };
      }
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboStrategies: updated }),
      });
      setComboStrategies(updated);
    } catch (error) {
      console.log("Error bulk updating route strategy:", error);
      setPublishError("Failed to update strategy for the selected routes.");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleTestCombo = async (combo, overrides = {}) => {
    const storedStrategy = comboStrategies[combo.name] || {};
    const strategy = overrides.strategy || storedStrategy.fallbackStrategy || "fallback";
    setComboTests((current) => ({
      ...current,
      [combo.id]: { testing: true, strategy, results: [] },
    }));

    try {
      const response = await fetch(`/api/combos/${combo.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overrides),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Failed to test model route");
      const result = { ...body, testing: false };
      setComboTests((current) => ({ ...current, [combo.id]: result }));
      return result;
    } catch (error) {
      const result = {
        testing: false,
        ok: false,
        strategy,
        results: [],
        error: error?.message || "Failed to test model route",
      };
      setComboTests((current) => ({ ...current, [combo.id]: result }));
      return result;
    }
  };

  const routeProviders = useMemo(() => {
    const set = new Set();
    for (const combo of combos) {
      const pName = String(combo.modelProvider || "").trim();
      if (pName) set.add(pName);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [combos]);

  const enabledRouteCount = useMemo(
    () => combos.filter((combo) => publishedIds.has(combo.id)).length,
    [combos, publishedIds],
  );

  const hasActiveFilters = Boolean(searchQuery.trim() || statusFilter !== "all" || providerFilter !== "all");

  const sortedCombos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = combos.filter((combo) => {
      if (statusFilter === "enabled" && !publishedIds.has(combo.id)) return false;
      if (statusFilter === "disabled" && publishedIds.has(combo.id)) return false;
      if (providerFilter !== "all" && String(combo.modelProvider || "").toLowerCase() !== providerFilter.toLowerCase()) {
        return false;
      }
      if (q) {
        const hay = [combo.name, combo.modelProvider, ...(combo.models || [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    switch (sortBy) {
      case "name":
        list.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" }));
        break;
      case "status":
        list.sort((a, b) => {
          const enabled = (combo) => publishedIds.has(combo.id);
          if (enabled(a) !== enabled(b)) return enabled(a) ? -1 : 1;
          return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" });
        });
        break;
      case "provider":
      default:
        list.sort((a, b) => {
          const pa = String(a.modelProvider || "").toLowerCase();
          const pb = String(b.modelProvider || "").toLowerCase();
          if (pa !== pb) return pa.localeCompare(pb);
          return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" });
        });
        break;
    }
    return list;
  }, [combos, sortBy, publishedIds, searchQuery, statusFilter, providerFilter]);

  const selectedCombos = combos.filter((combo) => selectedIds.includes(combo.id));
  const allSelected = sortedCombos.length > 0 && sortedCombos.every((combo) => selectedIds.includes(combo.id));
  const someSelected = selectedCombos.length > 0;

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <SegmentedControl
        size="sm"
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: "routes", label: `ROUTES ${combos.length}` },
          { value: "providers", label: `PROVIDERS ${modelProviders.length}` },
        ]}
      />

      {activeTab === "routes" ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Public model IDs, thinking defaults, advertised capabilities, pricing, and routing strategy.
              {combos.length > 0 && (
                <>
                  {" "}
                  <span className="font-mono text-xs font-medium text-foreground">
                    {enabledRouteCount}/{combos.length} enabled
                  </span>
                  {" — tune thinking, pricing, and strategy inline or click a route to edit."}
                </>
              )}
            </p>
            <Button icon="add" onClick={() => setShowCreateModal(true)} className="shrink-0 self-start whitespace-nowrap sm:self-auto">
              Create Route
            </Button>
          </div>

          {combos.length > 0 && (
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                  <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search route, provider, or model..."
                    aria-label="Search routes"
                    className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 [&::-webkit-search-cancel-button]:hidden"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <Icon name="close" className="size-3.5" />
                    </button>
                  )}
                </div>

                <div className="inline-flex h-9 items-center gap-0.5 rounded-md border border-border bg-muted/50 p-0.5 text-xs">
                  {[
                    { value: "all", label: `All (${combos.length})` },
                    { value: "enabled", label: `Enabled (${enabledRouteCount})` },
                    { value: "disabled", label: `Off (${combos.length - enabledRouteCount})` },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setStatusFilter(item.value)}
                      className={`h-full cursor-pointer rounded-sm px-2.5 font-medium transition-colors ${
                        statusFilter === item.value
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {routeProviders.length > 1 && (
                  <Select
                    options={[
                      { value: "all", label: `All providers (${routeProviders.length})` },
                      ...routeProviders.map((name) => ({ value: name, label: name })),
                    ]}
                    value={providerFilter}
                    onChange={(event) => setProviderFilter(event.target.value)}
                    selectClassName="h-9 w-44 py-1 text-xs"
                    aria-label="Filter by provider"
                  />
                )}
                <Select
                  options={SORT_OPTIONS}
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  selectClassName="h-9 w-40 py-1 text-xs"
                  aria-label="Sort routes"
                />
                {hasActiveFilters && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setProviderFilter("all");
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Model Routes Table */}
          {combos.length === 0 ? (
            <Card>
              <div className="py-12 text-center">
                <div className="mb-4 inline-flex size-16 items-center justify-center rounded-xl border border-border bg-muted text-foreground">
                  <Icon name="layers" className="size-7" />
                </div>
                <p className="mb-1 font-medium text-foreground">No model routes yet</p>
                <p className="mb-4 text-sm text-muted-foreground">Create a public model route with fallback support</p>
                <Button icon="add" onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto">
                  Create Route
                </Button>
              </div>
            </Card>
          ) : (
            <Card padding="none" className="min-w-0 overflow-hidden">
              {publishError && (
                <div role="alert" className="border-b border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {publishError}
                </div>
              )}
              {someSelected && (
                <div className="flex flex-col gap-2 border-b border-border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-mono text-xs font-medium text-foreground">{selectedCombos.length} selected</p>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => handleBulkTogglePublished(true)}>
                      Enable
                    </Button>
                    <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => handleBulkTogglePublished(false)}>
                      Disable
                    </Button>
                    <div className="w-full min-w-[10rem] sm:w-44">
                      <Select
                        options={STRATEGY_OPTIONS}
                        value=""
                        placeholder="Set strategy"
                        disabled={bulkBusy}
                        onChange={(event) => {
                          if (event.target.value) handleBulkSetStrategy(event.target.value);
                        }}
                        selectClassName="h-8 py-1 text-xs"
                        aria-label="Set strategy for selected routes"
                      />
                    </div>
                    <Button size="sm" variant="danger" disabled={bulkBusy} loading={bulkBusy} onClick={handleBulkDelete}>
                      Delete ({selectedCombos.length})
                    </Button>
                    <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setSelectedIds([])}>
                      Clear
                    </Button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="thead-data">
                    <tr className="text-xs font-medium tracking-wide text-muted-foreground">
                      <th className="w-10 px-2.5 py-2.5 font-medium">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(element) => {
                            if (element) element.indeterminate = someSelected && !allSelected;
                          }}
                          onChange={() => setSelectedIds(allSelected ? [] : sortedCombos.map((combo) => combo.id))}
                          aria-label="Select all routes"
                          className="size-4 accent-primary"
                        />
                      </th>
                      <th className="w-14 px-2 py-2.5 font-medium">On</th>
                      <th className="min-w-[180px] px-3 py-2.5 font-medium">Route</th>
                      <th className="min-w-[160px] px-2.5 py-2.5 font-medium">Members</th>
                      <th className="min-w-[185px] px-2.5 py-2.5 font-medium">Thinking &amp; Caps</th>
                      <th className="w-[130px] px-2.5 py-2.5 font-medium" title="Input / output, USD per one million tokens">
                        Price (in / out)
                      </th>
                      <th className="min-w-[185px] px-2.5 py-2.5 font-medium">Strategy</th>
                      <th className="w-[120px] px-2.5 py-2.5 text-right font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tbody-data">
                    {sortedCombos.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                          No routes match your current filter.
                        </td>
                      </tr>
                    ) : sortedCombos.map((combo) => (
                      <ComboTableRow
                        key={combo.id}
                        combo={combo}
                        published={publishedIds.has(combo.id)}
                        publishing={publishingId === combo.id}
                        onTogglePublished={(enabled) => handleTogglePublished(combo, enabled)}
                        modelProvider={modelProviders.find((provider) => provider.name.toLowerCase() === String(combo.modelProvider || "").toLowerCase())}
                        copied={copied}
                        onCopy={copy}
                        onEdit={(tab = "models") => {
                          setEditingInitialTab(tab);
                          setEditingCombo(combo);
                        }}
                        onInlineThinkingChange={(mode) => handleInlineThinkingChange(combo, mode)}
                        inlineUpdating={inlineUpdatingId === combo.id}
                        onDelete={() => handleDelete(combo.id)}
                        canEditPricing={canEditPricing}
                        onEditPricing={() => setPricingCombo(combo)}
                        strategy={comboStrategies[combo.name] || {}}
                        onSetStrategy={(patch) => handleSetComboStrategy(combo.name, patch)}
                        onSelectJudge={() => setJudgeCombo(combo)}
                        onSelectRouter={() => setRouterCombo(combo)}
                        onEditPolicy={() => setPolicyCombo(combo)}
                        activeProviders={activeProviders}
                        testState={comboTests[combo.id]}
                        onTest={(overrides) => handleTestCombo(combo, overrides)}
                        selected={selectedIds.includes(combo.id)}
                        onToggleSelect={() => setSelectedIds((current) => (
                          current.includes(combo.id)
                            ? current.filter((id) => id !== combo.id)
                            : [...current, combo.id]
                        ))}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

      {/* Capacity Adapter */}
      <CapacityAdapterSection
        capacityAdapter={capacityAdapter}
        onChange={handleSetCapacityAdapter}
        activeProviders={activeProviders}
        getCaps={getCaps}
      />

      {showCreateModal && (
        <RouteEditorModal
          key="create"
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreate}
          activeProviders={activeProviders}
          modelProviders={modelProviders}
          canEditPricing={canEditPricing}
        />
      )}

      {editingCombo && (
        <RouteEditorModal
          key={`${editingCombo.id}-${editingInitialTab}`}
          isOpen={!!editingCombo}
          combo={editingCombo}
          initialTab={editingInitialTab}
          onClose={() => setEditingCombo(null)}
          onSave={(data, pricingRequest) => handleUpdate(editingCombo.id, data, pricingRequest)}
          activeProviders={activeProviders}
          modelProviders={modelProviders}
          canEditPricing={canEditPricing}
          strategy={comboStrategies[editingCombo.name] || {}}
          testState={comboTests[editingCombo.id]}
          onTest={(overrides) => handleTestCombo(editingCombo, overrides)}
        />
      )}

          {pricingCombo && (
            <RoutePricingModal
              key={`pricing-${pricingCombo.id}`}
              combo={pricingCombo}
              onClose={() => setPricingCombo(null)}
              onSave={(pricing) => handleSavePricing(pricingCombo, pricing)}
              onReset={() => handleResetPricing(pricingCombo)}
            />
          )}

          {judgeCombo && (
            <ModelSelectModal
              isOpen={true}
              onClose={() => setJudgeCombo(null)}
              onSelect={(model) => {
                handleSetComboStrategy(judgeCombo.name, { judgeModel: model?.value || "" });
                setJudgeCombo(null);
              }}
              activeProviders={activeProviders}
              title={`Select Judge for ${judgeCombo.name}`}
              addedModelValues={
                comboStrategies[judgeCombo.name]?.judgeModel
                  ? [comboStrategies[judgeCombo.name].judgeModel]
                  : []
              }
              closeOnSelect={true}
            />
          )}

          {routerCombo && (
            <ModelSelectModal
              isOpen={true}
              onClose={() => setRouterCombo(null)}
              onSelect={(model) => {
                handleSetComboStrategy(routerCombo.name, { routerModel: model?.value || "" });
                setRouterCombo(null);
              }}
              activeProviders={activeProviders}
              title={`Select System One Router for ${routerCombo.name}`}
              kindFilter="systemone"
              addedModelValues={
                comboStrategies[routerCombo.name]?.routerModel
                  ? [comboStrategies[routerCombo.name].routerModel]
                  : []
              }
              closeOnSelect={true}
            />
          )}

          {policyCombo && (
            <SmartPolicyModal
              isOpen={true}
              onClose={() => setPolicyCombo(null)}
              comboName={policyCombo.name}
              currentPolicy={getSmartPolicy(comboStrategies[policyCombo.name])}
              currentThreshold={comboStrategies[policyCombo.name]?.confidenceThreshold ?? 80}
              onSave={(patch) => handleSetComboStrategy(policyCombo.name, patch)}
            />
          )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={confirmState?.onConfirm}
        title={confirmState?.title || "Confirm"}
        message={confirmState?.message}
        variant="danger"
      />
        </>
      ) : (
        <ModelProvidersPanel
          providers={modelProviders}
          combos={combos}
          onChanged={fetchData}
        />
      )}
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "provider", label: "Sort by Provider" },
  { value: "name", label: "Sort by Name" },
  { value: "status", label: "Enabled first" },
];

const STRATEGY_OPTIONS = [
  { value: "fallback", label: "Fallback" },
  { value: "round-robin", label: "Round Robin" },
  { value: "smart", label: "Smart Router" },
  { value: "fusion", label: "Fusion" },
];

function getSmartPolicy(strategy = {}) {
  return strategy.smartPolicy || (strategy.sessionSticky === false ? "per-turn" : "smart");
}

function getPolicyBadgeLabel(strategy = {}) {
  const policy = getSmartPolicy(strategy);
  if (policy === "strict") return "Strict Lock";
  if (policy === "per-turn") return "Per-Turn";
  if (policy === "custom") {
    const raw = strategy.confidenceThreshold;
    const pct = Math.round((raw || 0.8) * (raw && raw <= 1 ? 100 : 1));
    return `Custom (≥${pct || 80}%)`;
  }
  return "Smart (≥80%)";
}

// A keyless (noAuth) router provider works out of the box; anything else needs an active connection.
function getRouterModelStatus(routerModel, activeProviders) {
  const effectiveModel = routerModel?.trim() || DEFAULT_SYSTEMONE_ROUTER_MODEL;
  const slashIdx = effectiveModel.indexOf("/");
  const providerId = resolveProviderId(slashIdx !== -1 ? effectiveModel.slice(0, slashIdx) : effectiveModel);
  if (AI_PROVIDERS[providerId]?.noAuth) return { ready: true, label: "Ready (Free)", providerId };
  const connected = (activeProviders || []).some((c) => c.provider === providerId && c.isActive !== false);
  return connected
    ? { ready: true, label: "Connected", providerId }
    : { ready: false, label: "Not configured", providerId };
}

function ModelProvidersPanel({ providers, combos, onChanged }) {
  const [formState, setFormState] = useState(null);
  const [deletingProvider, setDeletingProvider] = useState(null);
  const [error, setError] = useState("");

  const usageCount = (providerName) => combos.filter(
    (combo) => String(combo.modelProvider || "").toLowerCase() === providerName.toLowerCase(),
  ).length;

  const handleDelete = async () => {
    if (!deletingProvider) return;
    setError("");
    try {
      const response = await fetch(
        `/api/models/providers?id=${encodeURIComponent(deletingProvider.id)}`,
        { method: "DELETE" },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Failed to delete provider");
      setDeletingProvider(null);
      await onChanged();
    } catch (reason) {
      setDeletingProvider(null);
      setError(reason.message || "Failed to delete provider");
    }
  };

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-mono text-sm font-semibold text-foreground">Virtual Providers</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Manage the public model owners shown in Dashboard / Models and returned as owned_by from /v1/models.
          </p>
        </div>
        <Button
          type="button"
          icon="add"
          onClick={() => setFormState({ provider: null })}
          className="w-full sm:w-auto"
        >
          Add Provider
        </Button>
      </div>

      {error && (
        <div role="alert" className="border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {providers.length === 0 ? (
        <Card className="py-12 text-center">
          <Icon name="category" className="size-9 text-muted-foreground" />
          <h3 className="mt-3 font-mono text-sm font-semibold text-foreground">No virtual providers</h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Add a provider before assigning an owner to a model route.
          </p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-border">
            {providers.map((provider) => {
              const routes = usageCount(provider.name);
              return (
                <div key={provider.id} className="flex items-center gap-3 px-4 py-3">
                  <LobeProviderIcon
                    iconKey={provider.iconKey}
                    name={provider.name}
                    className="size-9"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm font-semibold text-foreground">{provider.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      lobehub.com/icons/{provider.iconKey} · {routes} route{routes === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFormState({ provider })}
                      className="inline-flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      aria-label={`Settings for ${provider.name}`}
                      title="Provider settings"
                    >
                      <Icon name="settings" className="size-[18px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingProvider(provider)}
                      disabled={routes > 0}
                      className="inline-flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={`Delete ${provider.name}`}
                      title={routes > 0 ? "Remove this provider from all routes before deleting it" : "Delete provider"}
                    >
                      <Icon name="delete" className="size-[18px]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {formState && (
        <ModelProviderFormModal
          key={formState.provider?.id || "new-provider"}
          provider={formState.provider}
          onClose={() => setFormState(null)}
          onSaved={async () => {
            setFormState(null);
            await onChanged();
          }}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deletingProvider)}
        onClose={() => setDeletingProvider(null)}
        onConfirm={handleDelete}
        title="Delete Provider"
        message={deletingProvider ? `Delete virtual provider \"${deletingProvider.name}\"?` : ""}
        variant="danger"
      />
    </section>
  );
}

function ModelProviderFormModal({ provider, onClose, onSaved }) {
  const [name, setName] = useState(provider?.name || "");
  const [iconInput, setIconInput] = useState(provider?.iconKey || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const iconKey = normalizeLobeIconKey(iconInput);
  const isEdit = Boolean(provider);

  const handleSave = async () => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError("Provider name is required");
      return;
    }
    if (!iconKey) {
      setError("Enter a Lobe icon URL or slug");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/models/providers", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEdit ? { id: provider.id } : {}),
          name: normalizedName,
          iconKey,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Failed to save provider");
      await onSaved();
    } catch (reason) {
      setError(reason.message || "Failed to save provider");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? "Provider Settings" : "Add Provider"}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            loading={saving}
            disabled={!name.trim() || !iconKey || saving}
          >
            {isEdit ? "Save provider" : "Add provider"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
          <LobeProviderIcon iconKey={iconKey} name={name || "Provider"} className="size-10" />
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-semibold text-foreground">
              {name.trim() || "Provider preview"}
            </p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {iconKey ? `lobehub.com/icons/${iconKey}` : "Enter a Lobe icon below"}
            </p>
          </div>
        </div>

        <Input
          label="Provider Name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          placeholder="OpenAI"
          maxLength={80}
          required
        />
        <Input
          label="Lobe Icon"
          value={iconInput}
          onChange={(event) => {
            setIconInput(event.target.value);
            setError("");
          }}
          placeholder="https://lobehub.com/icons/openai"
          hint="Paste a lobehub.com/icons URL or enter its slug, for example openai."
          maxLength={240}
          required
        />

        {error && (
          <div role="alert" className="border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

      </div>
    </Modal>
  );
}


function RouteTestDetails({ combo, testState }) {
  if (!testState) return null;
  const resultsByIndex = new Map((testState.results || []).map((result) => [result.index, result]));
  const strategyLabel = STRATEGY_OPTIONS.find((option) => option.value === testState.strategy)?.label || testState.strategy;

  return (
    <tr className="border-b border-border/60 bg-muted/30">
      <td colSpan={8} className="px-3 py-2">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
            <span className="uppercase tracking-wide text-muted-foreground">{strategyLabel} test</span>
            {testState.testing ? (
              <span className="text-primary">Running strategy path…</span>
            ) : testState.error ? (
              <span className="text-danger">{testState.error}</span>
            ) : (
              <span className={testState.ok ? "text-success" : "text-danger"}>{testState.message}</span>
            )}
          </div>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {/* Result indices are positions in the routed member list — the only
                members the server tests. */}
            {comboRoutedModels(combo).map((model, index) => (
              <TestStateMark
                key={`${model}-${index}`}
                model={model}
                result={testState.testing ? null : resultsByIndex.get(index)}
              />
            ))}
            {testState.judge && (
              <>
                <span className="self-center text-xs font-medium tracking-wide text-muted-foreground">Judge</span>
                <TestStateMark model={testState.judge.model} result={testState.judge} />
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function RouteProfileCell({ combo, onInlineThinkingChange, inlineUpdating = false, onEditBehavior }) {
  const routedModels = useMemo(() => comboRoutedModels(combo), [combo]);
  const thinkingProfile = useMemo(() => getComboThinkingProfile(routedModels), [routedModels]);
  const currentMode = combo.thinkingMode || "auto";
  const thinkingOptions = useMemo(() => {
    if (thinkingProfile.options.some((option) => option.value === currentMode)) {
      return thinkingProfile.options;
    }
    return [...thinkingProfile.options, thinkingModeMeta(currentMode)];
  }, [currentMode, thinkingProfile]);
  const effectiveCapabilities = getEffectiveComboCapabilities(combo);
  const activeCapabilities = MODEL_CAPABILITIES.filter(([key]) => effectiveCapabilities[key]);
  const overrideCount = Object.keys(normalizeCapabilityOverrides(combo.capabilityOverrides)).length;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Think</span>
        <div className="relative min-w-0">
          <select
            value={currentMode}
            disabled={inlineUpdating}
            onChange={(event) => onInlineThinkingChange?.(event.target.value)}
            aria-label={`Thinking mode for ${combo.name}`}
            title={thinkingModeMeta(currentMode).description}
            className={`h-6 cursor-pointer appearance-none rounded border bg-background pl-2 pr-6 font-mono text-[11px] font-medium outline-none transition-colors focus:border-ring disabled:opacity-50 ${
              currentMode === "auto"
                ? "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                : "border-primary/40 bg-primary/5 text-foreground"
            }`}
          >
            {thinkingOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Icon
            name="expand_more"
            className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onEditBehavior}
        className="inline-flex min-w-0 max-w-full cursor-pointer items-center gap-1 rounded px-1 py-0.5 -ml-1 text-left text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title={activeCapabilities.length > 0
          ? `Capabilities: ${activeCapabilities.map(([, label]) => label).join(", ")} — click to adjust`
          : "No capabilities advertised — click to configure"}
      >
        {activeCapabilities.slice(0, 5).map(([key, label, icon]) => (
          <Icon name={icon} className="size-3.5 shrink-0" key={key} aria-label={label} />
        ))}
        {activeCapabilities.length === 0 && (
          <span className="font-mono text-[11px]">No Caps</span>
        )}
        {activeCapabilities.length > 5 && (
          <span className="font-mono text-[10px]">+{activeCapabilities.length - 5}</span>
        )}
        {overrideCount > 0 && (
          <span className="ml-0.5 rounded bg-primary/10 px-1 font-mono text-[10px] font-medium text-primary">
            {overrideCount} mod
          </span>
        )}
      </button>
    </div>
  );
}

function CapacityAdapterSection({ capacityAdapter, onChange, activeProviders, getCaps }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">Vision Adapter</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your model can&apos;t read image/audio? Auto-switches to a model in the pool below.
          </p>
          <ul className="mt-1.5 text-[11px] text-muted-foreground flex flex-col gap-0.5">
            <li><span className="font-medium text-foreground">Vision</span> — images (png, jpg, webp, …)</li>
            <li><span className="font-medium text-foreground">Audio</span> — audio input</li>
          </ul>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {CAPACITY_ADAPTER_CAPS.map((cap) => (
          <CapacityAdapterCap
            key={cap.key}
            cap={cap}
            entry={capacityAdapter[cap.key] || EMPTY_CAP_ENTRY}
            onChange={(entry) => onChange({ ...capacityAdapter, [cap.key]: entry })}
            activeProviders={activeProviders}
            getCaps={getCaps}
          />
        ))}
      </div>
    </div>
  );
}

/** Input / output rates, clickable for administrators. */
function RoutePriceCell({ combo, canEdit, onEdit }) {
  const priceable = Boolean(combo.pricingTarget);
  const free = priceable && isFreePricing(combo.pricing);
  const custom = combo.pricingSource === "custom";

  const body = !priceable ? (
    <span className="font-mono text-[11px] text-muted-foreground">Needs provider</span>
  ) : free ? (
    <span className="font-mono text-[11px] font-semibold text-success">Free</span>
  ) : combo.pricing ? (
    <span className="font-mono text-[11px] tabular-nums text-foreground">
      {formatRate(combo.pricing.input)} <span className="text-muted-foreground">/</span> {formatRate(combo.pricing.output)}
    </span>
  ) : (
    <span className="font-mono text-[11px] text-muted-foreground">Not set</span>
  );

  const marker = custom && priceable && (
    <span
      className="shrink-0 rounded-sm border border-primary/40 px-1 font-mono text-[9px] uppercase tracking-wide text-primary"
      title="Custom price overrides the built-in default"
    >
      Custom
    </span>
  );

  if (!canEdit || !priceable) {
    return (
      <div className="flex min-w-0 items-center gap-1.5" title="USD per one million tokens">
        {body}
        {marker}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-1 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      title={`Set price for ${combo.name} (USD per one million tokens)`}
      aria-label={`Set price for ${combo.name}`}
    >
      {body}
      {marker}
      <Icon name="edit" className="shrink-0 size-[14px] text-muted-foreground group-hover:text-muted-foreground" />
    </button>
  );
}

function RoutePricingModal({ combo, onClose, onSave, onReset }) {
  const [draft, setDraft] = useState(() => draftFromPricing(combo.pricing || {}));
  const [free, setFree] = useState(() => isFreePricing(combo.pricing));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const busy = saving || resetting;

  const updateField = (field, value) => {
    setError("");
    setDraft((current) => {
      const merged = { ...current, [field]: value };
      // Typing a real rate leaves Free; zeroing everything back re-enters it.
      if (Number(value) > 0) setFree(false);
      else if (draftLooksFree(merged)) setFree(true);
      return merged;
    });
  };

  const toggleFree = (next) => {
    setError("");
    setFree(next);
    setDraft(next
      ? draftFromPricing(freePricing())
      : draftFromPricing(combo.defaultPricing || combo.pricing || {}));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const pricing = parseDraft(draft, { basePricing: combo.pricing || {}, free });
      await onSave(pricing);
      onClose();
    } catch (reason) {
      setError(reason.message || "Unable to save price");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setError("");
    try {
      await onReset();
      onClose();
    } catch (reason) {
      setError(reason.message || "Unable to restore default price");
    } finally {
      setResetting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Pricing — ${combo.name}`}
      description="Rates are USD per one million tokens ($/1M)."
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {combo.pricingSource === "custom" && (
              <Button type="button" variant="ghost" size="sm" onClick={handleReset} loading={resetting} disabled={busy}>
                Restore default
              </Button>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} loading={saving} disabled={busy}>
              Save price
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <p className="font-mono text-xs text-muted-foreground">
            Billing key:{" "}
            <code className="font-semibold text-foreground">
              {combo.pricingTarget?.provider}/{combo.pricingTarget?.model}
            </code>
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Free route</span>
            <span className="block text-xs text-muted-foreground">Bill this route at $0 on every rate.</span>
          </span>
          <Toggle
            size="sm"
            checked={free}
            disabled={busy}
            onChange={toggleFree}
            ariaLabel={`Set ${combo.name} free`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {PRICING_FIELDS.map(([field, label]) => (
            <div key={field}>
              <label
                htmlFor={`price-${field}`}
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                {label}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                  $
                </span>
                <input
                  id={`price-${field}`}
                  type="number"
                  min="0"
                  step="0.000001"
                  inputMode="decimal"
                  disabled={busy || free}
                  value={draft[field] ?? ""}
                  onChange={(event) => updateField(field, event.target.value)}
                  placeholder="0"
                  className="h-9 w-full rounded-md border border-input bg-background pl-6 pr-10 font-mono text-xs tabular-nums text-foreground outline-none transition-colors focus:border-ring disabled:opacity-50"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground">
                  /1M
                </span>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ComboTableRow({
  combo,
  modelProvider,
  published = false,
  publishing = false,
  onTogglePublished,
  copied,
  onCopy,
  onEdit,
  onInlineThinkingChange,
  inlineUpdating = false,
  onDelete,
  strategy = {},
  onSetStrategy,
  onSelectJudge,
  onSelectRouter,
  onEditPolicy,
  activeProviders = [],
  canEditPricing = false,
  onEditPricing,
  testState,
  onTest,
  selected = false,
  onToggleSelect,
}) {
  const current = strategy.fallbackStrategy || "fallback";
  const judge = strategy.judgeModel || "";
  const routerModel = strategy.routerModel || "";
  const isFusion = current === "fusion";
  const isSmart = current === "smart";
  // The row summarizes what the route actually serves, so switched-off members
  // are neither shown first nor counted.
  const routedModels = comboRoutedModels(combo);
  const firstModel = routedModels[0];
  const overflowModels = Math.max(routedModels.length - 1, 0);
  const skippedMembers = combo.models.length - routedModels.length;
  // Publishing requires an owner and at least one routed member (enforced server-side too).
  const publishable = Boolean(String(combo.modelProvider || "").trim()) && routedModels.length > 0;
  const toggleTitle = !publishable
    ? "Set a model provider and enable at least one routed model before enabling this route"
    : published
      ? "Enabled — listed in Dashboard / Models and routable through /v1"
      : "Disabled — hidden from Dashboard / Models and rejected by /v1";
  const testIcon = testState?.testing
    ? "progress_activity"
    : testState?.ok === true
      ? "check_circle"
      : testState?.ok === false
        ? "error"
        : "play_arrow";

  return (
    <>
      <tr
        className={`group ${
          published ? "" : "opacity-50 hover:opacity-100"
        }`}
      >
        <td className="px-2 py-2 align-middle">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select route ${combo.name}`}
            className="size-4 accent-primary"
          />
        </td>
        <td className="px-3 py-2 align-middle">
          <Toggle
            size="sm"
            checked={published}
            disabled={publishing || !publishable}
            onChange={(next) => onTogglePublished(next)}
            title={toggleTitle}
            ariaLabel={`${published ? "Disable" : "Enable"} route ${combo.name}`}
          />
        </td>
        <td className="px-3 py-2.5 align-middle">
          <button
            type="button"
            onClick={() => onEdit("models")}
            className="flex min-w-0 max-w-full cursor-pointer items-center gap-2.5 rounded-md p-1 -m-1 text-left transition-colors hover:bg-accent/60"
            title={`Edit route ${combo.name}`}
          >
            <LobeProviderIcon
              iconKey={modelProvider?.iconKey}
              name={combo.modelProvider || combo.name}
              className="size-7 shrink-0"
            />
            <span className="min-w-0">
              <code className="block truncate font-mono text-sm font-medium text-foreground" title={combo.name}>
                {combo.name}
              </code>
              <span className={`block truncate text-xs ${combo.modelProvider ? "text-muted-foreground" : "font-medium text-danger"}`}>
                {combo.modelProvider || "Provider not set"}
              </span>
            </span>
          </button>
        </td>
        <td
          className="px-2.5 py-2.5 align-middle"
          title={combo.models
            .map((model) => (routedModels.includes(model) ? model : `${model} (off)`))
            .join("\n")}
        >
          <button
            type="button"
            onClick={() => onEdit("models")}
            className="flex min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 -mx-1.5 text-left transition-colors hover:bg-accent/60"
          >
            {firstModel ? (
              <>
                <code className="block min-w-0 max-w-[180px] truncate font-mono text-xs text-foreground">
                  {firstModel}
                </code>
                {overflowModels > 0 && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                    +{overflowModels}
                  </span>
                )}
                {skippedMembers > 0 && (
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{skippedMembers} off</span>
                )}
              </>
            ) : (
              <span className="font-mono text-xs text-muted-foreground">+ Add models</span>
            )}
          </button>
        </td>
        <td className="px-2.5 py-2.5 align-middle">
          <RouteProfileCell
            combo={combo}
            onInlineThinkingChange={onInlineThinkingChange}
            inlineUpdating={inlineUpdating}
            onEditBehavior={() => onEdit("behavior")}
          />
        </td>
        <td className="px-2 py-2 align-middle">
          <RoutePriceCell
            combo={combo}
            canEdit={canEditPricing}
            onEdit={onEditPricing}
          />
        </td>
        <td className="px-2 py-2 align-middle">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="w-36 shrink-0">
              <Select
                options={STRATEGY_OPTIONS}
                value={current}
                onChange={(event) => onSetStrategy({ fallbackStrategy: event.target.value })}
                selectClassName="h-8 py-1 text-xs"
                aria-label={`Strategy for ${combo.name}`}
              />
            </div>
            {isFusion && (
              <>
                <button
                  type="button"
                  onClick={onSelectJudge}
                  className="inline-flex h-8 min-w-0 max-w-36 items-center gap-1 rounded-sm border border-dashed border-primary/40 px-2 font-mono text-[11px] text-primary transition-colors hover:border-primary hover:bg-primary/5"
                  title={judge ? `Judge: ${judge}` : `Auto judge: ${firstModel || "first model"}`}
                  aria-label={`Select judge for ${combo.name}`}
                >
                  <Icon name="gavel" className="shrink-0 size-3.5" />
                  <span className="truncate">{judge || "Auto"}</span>
                </button>
                {judge && (
                  <button
                    type="button"
                    onClick={() => onSetStrategy({ judgeModel: "" })}
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                    title="Reset judge to Auto"
                    aria-label={`Reset judge for ${combo.name}`}
                  >
                    <Icon name="close" className="size-3.5" />
                  </button>
                )}
              </>
            )}
            {isSmart && (() => {
              const routerStatus = getRouterModelStatus(routerModel, activeProviders);
              return (
                <>
                  <button
                    type="button"
                    onClick={onSelectRouter}
                    className={`inline-flex h-8 min-w-0 max-w-36 items-center gap-1 rounded-sm border border-dashed px-2 font-mono text-[11px] transition-colors ${routerStatus.ready ? "border-primary/40 text-primary hover:border-primary hover:bg-primary/5" : "border-danger/50 text-danger hover:bg-danger/5"}`}
                    title={`System One router: ${routerModel || `Auto — ${DEFAULT_SYSTEMONE_ROUTER_MODEL}`} (${routerStatus.label})`}
                    aria-label={`Select System One router for ${combo.name}`}
                  >
                    <Icon name="psychology" className="shrink-0 size-3.5" />
                    <span className="truncate">{routerModel || "Auto"}</span>
                  </button>
                  {!routerStatus.ready && (
                    <Link
                      href={`/dashboard/media-providers/systemone/${routerStatus.providerId}`}
                      className="shrink-0 text-[11px] font-medium text-primary hover:underline"
                      title="Connect the router provider in Media Providers"
                    >
                      Configure
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={onEditPolicy}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-sm border border-border px-2 text-[11px] text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5"
                    title="Routing policy and session stickiness"
                    aria-label={`Smart routing policy for ${combo.name}`}
                  >
                    <Icon name="tune" className="shrink-0 size-3.5 text-muted-foreground" />
                    <span>{getPolicyBadgeLabel(strategy)}</span>
                  </button>
                  {routerModel && (
                    <button
                      type="button"
                      onClick={() => onSetStrategy({ routerModel: "" })}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                      title="Reset router to Auto"
                      aria-label={`Reset router for ${combo.name}`}
                    >
                      <Icon name="close" className="size-3.5" />
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </td>
        <td className="px-2 py-2 text-right align-middle">
          <div className="flex items-center justify-end gap-0.5">
            <button
              type="button"
              onClick={() => onTest({ strategy: current, judgeModel: judge })}
              disabled={testState?.testing || routedModels.length === 0}
              className={`inline-flex size-7 items-center justify-center rounded-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                testState?.ok === true
                  ? "text-success hover:bg-success/10"
                  : testState?.ok === false
                    ? "text-danger hover:bg-danger/10"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
              }`}
              title={`Test ${current} route`}
              aria-label={`Test ${combo.name}`}
            >
              <Icon name={testIcon} className={`size-4 ${testState?.testing ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => onCopy(combo.name, `combo-${combo.id}`)}
              className="inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              title="Copy model route ID"
              aria-label={`Copy model route ID ${combo.name}`}
            >
              <Icon name={copied === `combo-${combo.id}` ? "check" : "content_copy"} className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onEdit("models")}
              className="inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              title="Edit route"
              aria-label={`Edit ${combo.name}`}
            >
              <Icon name="edit" className="size-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
              title="Delete route"
              aria-label={`Delete ${combo.name}`}
            >
              <Icon name="delete" className="size-4" />
            </button>
          </div>
        </td>
      </tr>
      <RouteTestDetails combo={combo} testState={testState} />
    </>
  );
}

function CapacityAdapterCap({ cap, entry, onChange, activeProviders, getCaps }) {
  const [showModelSelect, setShowModelSelect] = useState(false);
  const { enabled, roundRobin, models } = entry;

  const patch = (p) => onChange({ ...entry, ...p });

  const handleAdd = (model) => {
    const value = model?.value || model?.name || model;
    if (!value || models.includes(value)) return;
    patch({ models: [...models, value] });
  };

  const handleDeselect = (model) => {
    const value = model?.value || model?.name || model;
    const next = models.filter((m) => m !== value);
    patch({ models: next.length === 0 ? [DEFAULT_FALLBACK_MODEL] : next });
  };

  const handleRemove = (index) => {
    const next = models.filter((_, i) => i !== index);
    patch({ models: next.length === 0 ? [DEFAULT_FALLBACK_MODEL] : next });
  };

  const handleMove = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= models.length) return;
    const next = [...models];
    [next[index], next[target]] = [next[target], next[index]];
    patch({ models: next });
  };

  return (
    <Card padding="sm" className={`group ${!enabled ? "opacity-50" : ""}`}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Master toggle + icon + label */}
        <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
          <Toggle
            checked={enabled}
            onChange={(v) => patch({ enabled: v })}
            aria-label={`Enable ${cap.label} adapter`}
          />
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon name={cap.icon} className="text-primary size-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <code className="font-mono text-sm font-medium">{cap.label}</code>
              <span className="text-[10px] text-muted-foreground">— {cap.desc}</span>
            </div>
          </div>
        </div>

        {/* Actions: Round-robin toggle + Add Model */}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3 sm:shrink-0">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <Toggle
              checked={roundRobin}
              onChange={(v) => patch({ roundRobin: v })}
              disabled={!enabled}
              aria-label={`Round-robin ${cap.label} adapter`}
            />
            <span>Round</span>
          </label>
          <Button
            icon="add"
            variant="ghost"
            size="sm"
            onClick={() => setShowModelSelect(true)}
            disabled={!enabled}
            title={`Add ${cap.label} model`}
          >
            Add Model
          </Button>
        </div>
      </div>

      {/* Model pool list/table */}
      {models.length === 0 ? (
        <div className="mt-3 py-2 text-center text-xs text-muted-foreground italic">
          No models in pool (will fallback to {DEFAULT_FALLBACK_MODEL})
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-md border border-border">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/40 bg-surface-2 text-muted-foreground">
                <th className="w-12 px-3 py-1.5 font-medium text-center">#</th>
                <th className="px-3 py-1.5 font-medium">Model</th>
                <th className="w-24 px-3 py-1.5 font-medium text-center">Order</th>
                <th className="w-12 px-3 py-1.5 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 font-mono">
              {models.map((model, index) => (
                <tr key={`${model}-${index}`} className="hover:bg-surface-2/60 transition-colors">
                  <td className="px-3 py-2 text-center text-muted-foreground text-[11px] font-sans">
                    #{index + 1}
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="truncate">{model}</span>
                      <CapacityBadges caps={getCaps?.(model)} />
                      {model === DEFAULT_FALLBACK_MODEL && (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-sans text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          free default
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMove(index, -1)}
                        disabled={!enabled || index === 0}
                        className={`p-1 rounded transition-colors ${
                          !enabled || index === 0
                            ? "text-muted-foreground/30 cursor-not-allowed"
                            : "text-muted-foreground hover:text-primary hover:bg-surface-2"
                        }`}
                        title="Move up"
                      >
                        <Icon name="arrow_upward" className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, 1)}
                        disabled={!enabled || index === models.length - 1}
                        className={`p-1 rounded transition-colors ${
                          !enabled || index === models.length - 1
                            ? "text-muted-foreground/30 cursor-not-allowed"
                            : "text-muted-foreground hover:text-primary hover:bg-surface-2"
                        }`}
                        title="Move down"
                      >
                        <Icon name="arrow_downward" className="size-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemove(index)}
                      disabled={!enabled}
                      className={`p-1 rounded transition-colors ${
                        !enabled
                          ? "text-muted-foreground/30 cursor-not-allowed"
                          : "text-muted-foreground hover:bg-danger/10 hover:text-danger"
                      }`}
                      title="Remove model"
                    >
                      <Icon name="close" className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModelSelect && (
        <ModelSelectModal
          isOpen={showModelSelect}
          onClose={() => setShowModelSelect(false)}
          onSelect={handleAdd}
          onDeselect={handleDeselect}
          activeProviders={activeProviders}
          title={`Add ${cap.label} Model`}
          addedModelValues={models}
          capFilter={cap.key}
          closeOnSelect={false}
        />
      )}
    </Card>
  );
}

