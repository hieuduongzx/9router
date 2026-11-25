"use client";

import { useState, useEffect, useMemo } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { Button, Modal, Input, ModelSelectModal, Select, Toggle } from "@/shared/components";
import { Icon } from "@/shared/components/ui/icon";
import {
  PRICING_FIELDS,
  draftFromPricing,
  draftLooksFree,
  freePricing,
  isFreePricing,
  parseDraft,
} from "@/shared/utils/modelPricing";
import {
  MODEL_CAPABILITIES,
  deriveComboCapabilities,
  getComboThinkingProfile,
  normalizeCapabilityOverrides,
  thinkingModeMeta,
} from "@/shared/utils/comboModelConfig";
import { comboRoutedModels, normalizeDisabledMembers } from "open-sse/services/comboMembers.js";
import { comboPricingTarget } from "@/lib/publishedModelsCatalog";

const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

const STRATEGY_OPTIONS = [
  { value: "fallback", label: "Fallback" },
  { value: "round-robin", label: "Round Robin" },
  { value: "smart", label: "Smart Router" },
  { value: "fusion", label: "Fusion" },
];

export function TestStateMark({ model, result }) {
  const state = result?.state || "pending";
  const presentation = {
    pending: { icon: "progress_activity", color: "text-primary", label: "Testing", spin: true },
    success: { icon: "check_circle", color: "text-success", label: "Passed", spin: false },
    failed: { icon: "cancel", color: "text-danger", label: "Failed", spin: false },
    skipped: { icon: "remove_circle_outline", color: "text-muted-foreground", label: "Skipped", spin: false },
  }[state];
  const detail = result?.error
    ? `${presentation.label}: ${result.error}`
    : result?.latencyMs != null
      ? `${presentation.label} in ${result.latencyMs}ms`
      : presentation.label;

  return (
    <span
      className="inline-flex min-w-0 max-w-64 items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1"
      title={`${model} — ${detail}`}
    >
      <Icon
        name={presentation.icon}
        className={`shrink-0 size-3.5 ${presentation.color} ${presentation.spin ? "animate-spin" : ""}`}
      />
      <code className="truncate font-mono text-[11px] text-foreground">{model}</code>
      {result?.attemptOrder && (
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">#{result.attemptOrder}</span>
      )}
    </span>
  );
}

function ModelItem({
  id,
  index,
  model,
  enabled = true,
  isFirst,
  isLast,
  testResult,
  quickTestResult,
  onToggleEnabled,
  onEdit,
  onMoveUp,
  onMoveDown,
  onQuickTest,
  onRemove,
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 999 : undefined,
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(model);

  useEffect(() => {
    setDraft(model);
  }, [model]);

  const testPresentation = testResult && {
    pending: { icon: "progress_activity", color: "text-primary", label: "Testing", spin: true },
    success: { icon: "check_circle", color: "text-success", label: "Passed", spin: false },
    failed: { icon: "cancel", color: "text-danger", label: "Failed", spin: false },
    skipped: { icon: "remove_circle_outline", color: "text-muted-foreground", label: "Skipped", spin: false },
  }[testResult.state];

  const quickTestPresentation = quickTestResult && {
    pending: { icon: "progress_activity", color: "text-primary", label: "Testing", spin: true },
    success: { icon: "check_circle", color: "text-success", label: "Passed", spin: false },
    failed: { icon: "cancel", color: "text-danger", label: "Failed", spin: false },
  }[quickTestResult.state];

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== model) onEdit(trimmed);
    else setDraft(model);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      setDraft(model);
      setEditing(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-1.5 transition-colors hover:bg-muted/40 ${
        isDragging ? "ring-2 ring-primary/30" : ""
      } ${enabled ? "" : "opacity-60"}`}
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        title="Drag to reorder"
        aria-label={`Drag ${model} to reorder`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="9" cy="4" r="2" />
          <circle cx="15" cy="4" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="15" cy="12" r="2" />
          <circle cx="9" cy="20" r="2" />
          <circle cx="15" cy="20" r="2" />
        </svg>
      </button>

      <span className="w-4 shrink-0 text-center font-mono text-[11px] font-medium text-muted-foreground tabular-nums">
        {index + 1}
      </span>

      <Toggle
        size="sm"
        checked={enabled}
        onChange={onToggleEnabled}
        className="shrink-0"
        title={enabled ? "Routed — click to skip this member" : "Skipped — click to route this member again"}
        ariaLabel={`${enabled ? "Disable" : "Enable"} ${model}`}
      />

      {testPresentation && (
        <Icon
          name={testPresentation.icon}
          className={`shrink-0 size-3.5 ${testPresentation.color} ${testPresentation.spin ? "animate-spin" : ""}`}
          title={
            testResult.error ||
            `${testPresentation.label}${testResult.latencyMs != null ? ` in ${testResult.latencyMs}ms` : ""}`
          }
        />
      )}

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 rounded border border-primary/40 bg-background px-1.5 py-0.5 font-mono text-xs text-foreground outline-none"
        />
      ) : (
        <div
          className={`min-w-0 flex-1 cursor-text truncate rounded px-1.5 py-0.5 font-mono text-xs hover:bg-accent/60 ${
            enabled ? "text-foreground" : "text-muted-foreground line-through"
          }`}
          onClick={() => setEditing(true)}
          title={`${model} — click to edit inline`}
        >
          {model}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="Move model up"
          className={`rounded p-1 transition-colors ${
            isFirst ? "cursor-not-allowed text-muted-foreground/25" : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          title="Move up"
        >
          <Icon name="arrow_upward" className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="Move model down"
          className={`rounded p-1 transition-colors ${
            isLast ? "cursor-not-allowed text-muted-foreground/25" : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          title="Move down"
        >
          <Icon name="arrow_downward" className="size-3.5" />
        </button>
      </div>

      {onQuickTest && (
        <button
          type="button"
          onClick={onQuickTest}
          disabled={quickTestResult?.state === "pending"}
          className={`shrink-0 rounded p-1 transition-colors disabled:cursor-wait ${
            quickTestPresentation
              ? quickTestPresentation.color
              : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
          }`}
          title={
            quickTestResult?.error ||
            (quickTestResult?.latencyMs != null
              ? `${quickTestPresentation.label} in ${quickTestResult.latencyMs}ms`
              : `Test ${model}`)
          }
          aria-label={`Test ${model}`}
        >
          <Icon
            name={quickTestPresentation?.icon || "play_arrow"}
            className={`size-3.5 ${quickTestPresentation?.spin ? "animate-spin" : ""}`}
          />
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${model}`}
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        title="Remove"
      >
        <Icon name="close" className="size-3.5" />
      </button>
    </div>
  );
}

export default function RouteEditorModal({
  isOpen,
  combo,
  initialTab = "models",
  onClose,
  onSave,
  onTest,
  strategy = {},
  testState,
  activeProviders,
  modelProviders = [],
  canEditPricing = false,
  kindFilter = null,
}) {
  const [name, setName] = useState(combo?.name || "");
  const [models, setModels] = useState(combo?.models || []);
  const [modelProvider, setModelProvider] = useState(combo?.modelProvider || "");
  const [thinkingMode, setThinkingMode] = useState(combo?.thinkingMode || "auto");
  const [capabilityOverrides, setCapabilityOverrides] = useState(() =>
    normalizeCapabilityOverrides(combo?.capabilityOverrides),
  );
  const [disabledMembers, setDisabledMembers] = useState(() =>
    normalizeDisabledMembers(combo?.disabledMembers, combo?.models || []),
  );
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [providerError, setProviderError] = useState("");
  const [modelAliases, setModelAliases] = useState({});
  const [showJudgeSelect, setShowJudgeSelect] = useState(false);
  const [testStrategy, setTestStrategy] = useState(strategy.fallbackStrategy || "fallback");
  const [testJudge, setTestJudge] = useState(strategy.judgeModel || "");
  const [modalTestState, setModalTestState] = useState(testState || null);
  const [quickTestStates, setQuickTestStates] = useState({});
  const [priceDraft, setPriceDraft] = useState(() => draftFromPricing(combo?.pricing || {}));
  const [priceFree, setPriceFree] = useState(() => isFreePricing(combo?.pricing));
  const [priceTouched, setPriceTouched] = useState(false);
  const [priceReset, setPriceReset] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [modalTab, setModalTab] = useState(
    initialTab === "pricing" && !canEditPricing ? "models" : initialTab,
  );
  const [manualModelInput, setManualModelInput] = useState("");

  const disabledSet = useMemo(() => new Set(disabledMembers), [disabledMembers]);
  const routedModels = useMemo(
    () => comboRoutedModels({ models, disabledMembers }),
    [models, disabledMembers],
  );
  const routedIndexByMember = useMemo(
    () => new Map(routedModels.map((model, index) => [model, index])),
    [routedModels],
  );
  const baseCapabilities = useMemo(() => deriveComboCapabilities(routedModels), [routedModels]);
  const effectiveCapabilities = useMemo(
    () => ({ ...baseCapabilities, ...capabilityOverrides }),
    [baseCapabilities, capabilityOverrides],
  );
  const thinkingProfile = useMemo(() => getComboThinkingProfile(routedModels), [routedModels]);
  const thinkingOptions = useMemo(() => {
    if (thinkingProfile.options.some((option) => option.value === thinkingMode)) {
      return thinkingProfile.options;
    }
    return [...thinkingProfile.options, thinkingModeMeta(thinkingMode)];
  }, [thinkingMode, thinkingProfile]);
  const selectedThinking = thinkingModeMeta(thinkingMode);
  const capabilityOverrideCount = Object.keys(capabilityOverrides).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const modelItems = models.map((model, i) => ({ uid: `item-${i}`, model }));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = modelItems.findIndex((m) => m.uid === active.id);
      const newIndex = modelItems.findIndex((m) => m.uid === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        setModels((prev) => arrayMove(prev, oldIndex, newIndex));
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/models/alias")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setModelAliases(data.aliases || {});
      })
      .catch(() => {});
  }, [isOpen]);

  const validateName = (value) => {
    if (!value.trim()) {
      setNameError("Name is required");
      return false;
    }
    if (!VALID_NAME_REGEX.test(value)) {
      setNameError("Only letters, numbers, -, _ and . allowed");
      return false;
    }
    setNameError("");
    return true;
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setName(value);
    if (value) validateName(value);
    else setNameError("");
  };

  const handleAddModel = (model) => {
    if (!models.includes(model.value)) {
      setModels([...models, model.value]);
    }
  };

  const handleAddManualModel = () => {
    const trimmed = manualModelInput.trim();
    if (!trimmed) return;
    if (!models.includes(trimmed)) {
      setModels((prev) => [...prev, trimmed]);
    }
    setManualModelInput("");
  };

  const forgetDisabled = (model) => {
    setDisabledMembers((current) => current.filter((member) => member !== model));
  };

  const handleDeselectModel = (model) => {
    setModels(models.filter((m) => m !== model.value));
    forgetDisabled(model.value);
  };

  const handleRemoveModel = (index) => {
    const removed = models[index];
    setModels(models.filter((_, i) => i !== index));
    forgetDisabled(removed);
  };

  const handleToggleMember = (model, enabled) => {
    setDisabledMembers((current) =>
      enabled
        ? current.filter((member) => member !== model)
        : current.includes(model)
          ? current
          : [...current, model],
    );
  };

  const handleEditModel = (index, nextValue) => {
    const previous = models[index];
    const updated = [...models];
    updated[index] = nextValue;
    setModels(updated);
    setDisabledMembers((current) =>
      current.includes(previous)
        ? [...current.filter((member) => member !== previous), nextValue]
        : current,
    );
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newModels = [...models];
    [newModels[index - 1], newModels[index]] = [newModels[index], newModels[index - 1]];
    setModels(newModels);
  };

  const handleMoveDown = (index) => {
    if (index === models.length - 1) return;
    const newModels = [...models];
    [newModels[index], newModels[index + 1]] = [newModels[index + 1], newModels[index]];
    setModels(newModels);
  };

  const buildPricingRequest = (savedName, savedProvider) => {
    if (!canEditPricing) return null;
    const previousTarget = comboPricingTarget(combo);
    const movedFrom =
      previousTarget &&
      (previousTarget.provider !== savedProvider.toLowerCase() || previousTarget.model !== savedName)
        ? previousTarget
        : null;

    if (priceReset) return { mode: "reset", previousTarget: movedFrom };
    if (priceTouched) {
      return {
        mode: "set",
        pricing: parseDraft(priceDraft, { basePricing: combo?.pricing || {}, free: priceFree }),
        previousTarget: movedFrom,
      };
    }
    if (movedFrom && combo?.pricingSource === "custom" && combo.pricing) {
      return { mode: "set", pricing: combo.pricing, previousTarget: movedFrom };
    }
    return null;
  };

  const handleSave = async () => {
    if (!validateName(name)) return;
    const normalizedProvider = modelProvider.trim();
    if (!normalizedProvider) {
      setProviderError("Model provider is required before this route can be published");
      return;
    }
    setProviderError("");
    setSaveError("");

    let pricingRequest = null;
    try {
      pricingRequest = buildPricingRequest(name.trim(), normalizedProvider);
    } catch (reason) {
      setSaveError(reason.message || "Unable to save price");
      setModalTab("pricing");
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          name: name.trim(),
          models,
          modelProvider: normalizedProvider,
          thinkingMode,
          capabilityOverrides,
          disabledMembers: normalizeDisabledMembers(disabledMembers, models),
        },
        pricingRequest,
      );
    } catch (reason) {
      setSaveError(reason.message || "Failed to save route");
    } finally {
      setSaving(false);
    }
  };

  const updatePriceField = (field, value) => {
    setSaveError("");
    setPriceTouched(true);
    setPriceReset(false);
    setPriceDraft((current) => {
      const merged = { ...current, [field]: value };
      if (Number(value) > 0) setPriceFree(false);
      else if (draftLooksFree(merged)) setPriceFree(true);
      return merged;
    });
  };

  const togglePriceFree = (next) => {
    setSaveError("");
    setPriceTouched(true);
    setPriceReset(false);
    setPriceFree(next);
    setPriceDraft(
      next
        ? draftFromPricing(freePricing())
        : draftFromPricing(combo?.defaultPricing || combo?.pricing || {}),
    );
  };

  const requestPriceReset = () => {
    setSaveError("");
    setPriceTouched(false);
    setPriceReset(true);
    setPriceDraft(draftFromPricing(combo?.defaultPricing || {}));
    setPriceFree(isFreePricing(combo?.defaultPricing));
  };

  const handleCapabilityChange = (key, enabled) => {
    setCapabilityOverrides((current) => {
      const next = { ...current };
      if (Boolean(baseCapabilities[key]) === enabled) delete next[key];
      else next[key] = enabled;
      return next;
    });
  };

  const handleRunTest = async () => {
    const testedModels = [...routedModels];
    setModalTestState({
      testing: true,
      strategy: testStrategy,
      results: [],
      testedModels,
    });
    try {
      const result = await onTest({
        models: testedModels,
        strategy: testStrategy,
        judgeModel: testJudge,
      });
      setModalTestState({ ...result, testedModels });
    } catch (error) {
      setModalTestState({
        testing: false,
        ok: false,
        strategy: testStrategy,
        results: [],
        testedModels,
        error: error?.message || "Failed to test model route",
      });
    }
  };

  const handleQuickTest = async (uid, model) => {
    setQuickTestStates((current) => ({ ...current, [uid]: { state: "pending" } }));
    try {
      const result = await onTest({ models: [model], strategy: "fallback", judgeModel: "" });
      const modelResult = result?.results?.[0];
      setQuickTestStates((current) => ({
        ...current,
        [uid]: modelResult || {
          state: result?.ok ? "success" : "failed",
          error: result?.error || result?.message || "Model test failed",
        },
      }));
    } catch (error) {
      setQuickTestStates((current) => ({
        ...current,
        [uid]: { state: "failed", error: error?.message || "Model test failed" },
      }));
    }
  };

  const isEdit = !!combo;
  const modalResultsByIndex = new Map((modalTestState?.results || []).map((result) => [result.index, result]));
  const activeCapCount = MODEL_CAPABILITIES.filter(([key]) => effectiveCapabilities[key]).length;
  const footerPriceSummary = canEditPricing
    ? priceFree
      ? "Free"
      : priceDraft.input || priceDraft.output
        ? `$${priceDraft.input || "0"} / $${priceDraft.output || "0"}`
        : "Default price"
    : null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? `Edit Route — ${combo.name}` : "Create Model Route"}
        description="Configure routing members, thinking defaults, advertised capabilities, and pricing."
        size="3xl"
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-mono font-medium text-foreground">
                {routedModels.length}/{models.length} routed
              </span>
              <span>·</span>
              <span>
                Thinking: <strong className="font-medium text-foreground">{selectedThinking.label}</strong>
              </span>
              {footerPriceSummary && (
                <>
                  <span>·</span>
                  <span className="font-mono">{footerPriceSummary}</span>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" onClick={onClose} variant="outline" disabled={saving}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                loading={saving}
                disabled={!name.trim() || !modelProvider.trim() || !!nameError || saving}
              >
                {isEdit ? "Save route" : "Create route"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          {/* Compact 2-column route identity */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Route ID"
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. gpt-5.4 or claude-sonnet-4.6"
              error={nameError}
              inputClassName="font-mono text-sm"
              hint={!nameError ? "Letters, numbers, -, _ and . only" : undefined}
            />

            <Select
              label="Model Provider"
              required
              value={modelProvider}
              onChange={(event) => {
                setModelProvider(event.target.value);
                if (event.target.value) setProviderError("");
              }}
              disabled={modelProviders.length === 0}
              error={providerError}
              hint={
                !providerError
                  ? modelProviders.length > 0
                    ? "Exposed as owned_by in /v1/models"
                    : "Create a provider in the Providers tab first."
                  : undefined
              }
              options={[
                ...(modelProvider && !modelProviders.some((provider) => provider.name === modelProvider)
                  ? [{ value: modelProvider, label: `${modelProvider} (legacy)` }]
                  : []),
                ...modelProviders.map((provider) => ({ value: provider.name, label: provider.name })),
              ]}
            />
          </div>

          {/* Studio section tabs */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-px">
            {[
              {
                id: "models",
                label: "Models & Test",
                icon: "layers",
                badge: `${routedModels.length}/${models.length}`,
              },
              {
                id: "behavior",
                label: "Thinking & Caps",
                icon: "tune",
                badge: `${selectedThinking.label} · ${activeCapCount}`,
              },
              ...(canEditPricing
                ? [
                    {
                      id: "pricing",
                      label: "Pricing",
                      icon: "attach_money",
                      badge: footerPriceSummary,
                    },
                  ]
                : []),
            ].map((tab) => {
              const active = modalTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setModalTab(tab.id)}
                  className={`relative inline-flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                    active
                      ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon name={tab.icon} className="size-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none ${
                        active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB 1: Models & Test */}
          {modalTab === "models" && (
            <div className="flex flex-col gap-4">
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Routed members</p>
                    <p className="text-xs text-muted-foreground">
                      Drag to set fallback order, toggle off to pause a member, or click its ID to edit inline.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon="add"
                    onClick={() => setShowModelSelect(true)}
                  >
                    Browse catalog
                  </Button>
                </div>

                {models.length === 0 ? (
                  <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-muted/20 py-7 text-center">
                    <Icon name="layers" className="mb-1.5 size-6 text-muted-foreground/70" />
                    <p className="text-sm font-medium text-foreground">No models in this route yet</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Browse connected providers or type a model ID below.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon="add"
                      onClick={() => setShowModelSelect(true)}
                      className="mt-3"
                    >
                      Add models from catalog
                    </Button>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                  >
                    <SortableContext items={modelItems.map((m) => m.uid)} strategy={verticalListSortingStrategy}>
                      <div className="flex max-h-[300px] min-w-0 flex-col gap-1.5 overflow-y-auto pr-0.5">
                        {modelItems.map(({ uid, model }, index) => {
                          const routedIndex = routedIndexByMember.get(model);
                          const tested =
                            routedIndex != null && modalTestState?.testedModels?.[routedIndex] === model;
                          return (
                            <ModelItem
                              key={uid}
                              id={uid}
                              index={index}
                              model={model}
                              enabled={!disabledSet.has(model)}
                              isFirst={index === 0}
                              isLast={index === modelItems.length - 1}
                              testResult={
                                tested
                                  ? modalTestState.testing
                                    ? { state: "pending" }
                                    : modalResultsByIndex.get(routedIndex)
                                  : null
                              }
                              quickTestResult={quickTestStates[uid]}
                              onToggleEnabled={(next) => handleToggleMember(model, next)}
                              onEdit={(newVal) => handleEditModel(index, newVal)}
                              onMoveUp={() => handleMoveUp(index)}
                              onMoveDown={() => handleMoveDown(index)}
                              onQuickTest={isEdit && onTest ? () => handleQuickTest(uid, model) : null}
                              onRemove={() => handleRemoveModel(index)}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}

                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    type="text"
                    value={manualModelInput}
                    onChange={(event) => setManualModelInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddManualModel();
                      }
                    }}
                    placeholder="Quick add model ID (e.g. openai/gpt-5.4) and press Enter"
                    className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 font-mono text-xs outline-none focus:border-ring"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddManualModel}
                    disabled={!manualModelInput.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {isEdit && onTest && (
                <div className="rounded-lg border border-border bg-muted/20 p-3.5">
                  <div className="mb-2.5 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Test route</p>
                      <p className="text-xs text-muted-foreground">
                        Verify enabled members through a routing strategy.
                      </p>
                    </div>
                    {modalTestState && !modalTestState.testing && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          modalTestState.ok
                            ? "bg-success/15 text-success"
                            : "bg-danger/15 text-danger"
                        }`}
                      >
                        {modalTestState.ok ? "Passed" : "Failed"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <Select
                        label="Strategy"
                        options={STRATEGY_OPTIONS}
                        value={testStrategy}
                        onChange={(event) => {
                          setTestStrategy(event.target.value);
                          setModalTestState(null);
                        }}
                        selectClassName="h-9 py-1 text-xs"
                      />
                    </div>
                    {testStrategy === "fusion" && (
                      <button
                        type="button"
                        onClick={() => setShowJudgeSelect(true)}
                        className="inline-flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-primary/40 px-3 font-mono text-xs text-primary transition-colors hover:border-primary hover:bg-primary/5"
                        title={testJudge ? `Judge: ${testJudge}` : `Auto judge: ${models[0] || "first model"}`}
                      >
                        <Icon name="gavel" className="size-3.5 shrink-0" />
                        <span className="truncate">{testJudge || "Auto judge"}</span>
                      </button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      icon="play_arrow"
                      onClick={handleRunTest}
                      loading={modalTestState?.testing}
                      disabled={routedModels.length === 0 || modalTestState?.testing}
                      className="h-9 shrink-0"
                    >
                      Run test
                    </Button>
                  </div>
                  {modalTestState && !modalTestState.testing && (
                    <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        className={`min-w-0 font-mono text-[11px] ${
                          modalTestState.ok ? "text-success" : "text-danger"
                        }`}
                      >
                        {modalTestState.error || modalTestState.message}
                      </span>
                      {modalTestState.judge && (
                        <TestStateMark model={`Judge: ${modalTestState.judge.model}`} result={modalTestState.judge} />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Thinking & Capabilities */}
          {modalTab === "behavior" && (
            <div className="flex flex-col gap-5">
              <div className="rounded-lg border border-border p-4">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Thinking effort default</p>
                    <p className="text-xs text-muted-foreground">
                      Client requests always win. {thinkingProfile.reasoningModels} reasoning member
                      {thinkingProfile.reasoningModels === 1 ? "" : "s"} in this route.
                    </p>
                  </div>
                  <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                    {selectedThinking.label}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {thinkingOptions.map((option) => {
                    const active = thinkingMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setThinkingMode(option.value)}
                        className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-all ${
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-xs"
                            : "border-border bg-background text-foreground hover:border-foreground/30 hover:bg-accent"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                  {selectedThinking.description}
                </p>

                {thinkingMode === "none" && thinkingProfile.cannotDisable > 0 && (
                  <p className="mt-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
                    {thinkingProfile.cannotDisable} member{thinkingProfile.cannotDisable === 1 ? "" : "s"} cannot
                    fully disable reasoning and will use the minimum supported level.
                  </p>
                )}
              </div>

              <div>
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Advertised capabilities</p>
                    <p className="text-xs text-muted-foreground">
                      Published in Dashboard / Models &amp; <code className="font-mono">/v1/models</code>. Inherited
                      from enabled members unless overridden.
                    </p>
                  </div>
                  {capabilityOverrideCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setCapabilityOverrides({})}
                    >
                      Reset {capabilityOverrideCount} override{capabilityOverrideCount === 1 ? "" : "s"}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {MODEL_CAPABILITIES.map(([key, label, icon]) => {
                    const overridden = Object.prototype.hasOwnProperty.call(capabilityOverrides, key);
                    const enabled = Boolean(effectiveCapabilities[key]);
                    return (
                      <div
                        key={key}
                        onClick={() => handleCapabilityChange(key, !enabled)}
                        className={`flex min-w-0 cursor-pointer items-center justify-between gap-2.5 rounded-lg border px-3 py-2.5 transition-all ${
                          enabled
                            ? overridden
                              ? "border-primary/50 bg-primary/8"
                              : "border-border bg-background shadow-2xs hover:border-foreground/30"
                            : overridden
                              ? "border-warning/40 bg-warning/5"
                              : "border-border/60 bg-muted/25 opacity-75 hover:opacity-100"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-md ${
                              enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Icon name={icon} className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <span className="block truncate text-xs font-medium text-foreground">{label}</span>
                            <span
                              className={`block text-[10px] font-medium ${
                                overridden
                                  ? enabled
                                    ? "text-primary"
                                    : "text-warning"
                                  : enabled
                                    ? "text-muted-foreground"
                                    : "text-muted-foreground/70"
                              }`}
                            >
                              {overridden ? (enabled ? "Override on" : "Override off") : enabled ? "Auto (on)" : "Off"}
                            </span>
                          </div>
                        </div>
                        <div onClick={(event) => event.stopPropagation()}>
                          <Toggle
                            size="sm"
                            checked={enabled}
                            onChange={(next) => handleCapabilityChange(key, next)}
                            ariaLabel={`${enabled ? "Disable" : "Enable"} ${label} for ${name || "this route"}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Pricing */}
          {modalTab === "pricing" && canEditPricing && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">
                    Billing key:{" "}
                    <code className="font-semibold text-foreground">
                      {(modelProvider.trim() || "provider").toLowerCase()}/{name.trim() || "route"}
                    </code>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    USD per one million tokens ($/1M). Saved together with the route.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {priceReset && (
                    <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-medium text-primary">
                      Default restored on save
                    </span>
                  )}
                  {!priceReset && combo?.pricingSource === "custom" && (
                    <Button type="button" variant="outline" size="xs" onClick={requestPriceReset}>
                      Restore default
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">Free route</span>
                  <span className="block text-xs text-muted-foreground">
                    Bill this route at $0 across all token categories.
                  </span>
                </span>
                <Toggle
                  size="sm"
                  checked={priceFree}
                  disabled={saving}
                  onChange={togglePriceFree}
                  ariaLabel={`Set ${name || "this route"} free`}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PRICING_FIELDS.map(([field, label]) => (
                  <div key={field}>
                    <label
                      htmlFor={`route-price-${field}`}
                      className="mb-1 block text-xs font-medium text-muted-foreground"
                    >
                      {label}
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                        $
                      </span>
                      <input
                        id={`route-price-${field}`}
                        type="number"
                        min="0"
                        step="0.000001"
                        inputMode="decimal"
                        disabled={saving || priceFree}
                        value={priceDraft[field] ?? ""}
                        onChange={(event) => updatePriceField(field, event.target.value)}
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
            </div>
          )}

          {saveError && (
            <div role="alert" className="rounded-md border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
              {saveError}
            </div>
          )}
        </div>
      </Modal>

      {showModelSelect && (
        <ModelSelectModal
          isOpen={showModelSelect}
          onClose={() => setShowModelSelect(false)}
          onSelect={handleAddModel}
          onDeselect={handleDeselectModel}
          onSelectBatch={(items) => {
            const vals = items.map((m) => m?.value || m?.name || m).filter(Boolean);
            setModels((prev) => [...new Set([...prev, ...vals])]);
          }}
          onDeselectBatch={(items) => {
            const vals = new Set(items.map((m) => m?.value || m?.name || m).filter(Boolean));
            setModels((prev) => prev.filter((m) => !vals.has(m)));
          }}
          activeProviders={activeProviders}
          modelAliases={modelAliases}
          title="Add Model to Route"
          kindFilter={kindFilter}
          addedModelValues={models}
          closeOnSelect={false}
        />
      )}

      {showJudgeSelect && (
        <ModelSelectModal
          isOpen={showJudgeSelect}
          onClose={() => setShowJudgeSelect(false)}
          onSelect={(model) => {
            setTestJudge(model?.value || "");
            setModalTestState(null);
            setShowJudgeSelect(false);
          }}
          activeProviders={activeProviders}
          modelAliases={modelAliases}
          title={`Select Judge for ${name || combo?.name}`}
          kindFilter={kindFilter}
          addedModelValues={testJudge ? [testJudge] : []}
          closeOnSelect={true}
        />
      )}
    </>
  );
}
