"use client";

import { useState, useEffect, useCallback } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { Card, Button, Modal, Input, CardSkeleton, ModelSelectModal, ConfirmModal, Select, SegmentedControl, Toggle } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import LobeProviderIcon from "@/shared/components/LobeProviderIcon";
import { normalizeLobeIconKey } from "@/shared/utils/lobeIcons";

// Validate combo name: only a-z, A-Z, 0-9, -, _
const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

export default function CombosPage() {
  const [combos, setCombos] = useState([]);
  const [activeTab, setActiveTab] = useState("routes");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState(null);
  const [judgeCombo, setJudgeCombo] = useState(null);
  const [activeProviders, setActiveProviders] = useState([]);
  const [modelProviders, setModelProviders] = useState([]);
  const [comboStrategies, setComboStrategies] = useState({});
  const [comboTests, setComboTests] = useState({});
  const [confirmState, setConfirmState] = useState(null);
  // Enabled route = published model. Same store as Dashboard / Models.
  const [publishedIds, setPublishedIds] = useState(() => new Set());
  const [publishingId, setPublishingId] = useState("");
  const [publishError, setPublishError] = useState("");
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (combosRes.ok) setCombos((combosData.combos || []).filter(c => !c.kind || c.kind === "llm"));
      if (providersRes.ok) {
        setActiveProviders(providersData.connections || []);
      }
      if (modelProvidersRes.ok) setModelProviders(modelProvidersData.providers || []);
      setComboStrategies(settingsData.comboStrategies || {});
    } catch (error) {
      console.log("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    try {
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        // A new route starts enabled when it already has an owner and members,
        // so creating one makes it immediately routable.
        const created = await res.json().catch(() => null);
        if (created?.id && created.modelProvider && (created.models || []).length > 0) {
          await handleTogglePublished(created, true);
        }
        await fetchData();
        setShowCreateModal(false);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create combo");
      }
    } catch (error) {
      console.log("Error creating combo:", error);
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      const res = await fetch(`/api/combos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchData();
        setComboTests((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        setEditingCombo(null);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update combo");
      }
    } catch (error) {
      console.log("Error updating combo:", error);
    }
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

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
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
            <p className="text-sm text-text-muted">
              Public model IDs, provider ownership, routed members, and fallback strategy.
              {combos.length > 0 && (
                <>
                  {" "}
                  <span className="font-mono text-xs">
                    {combos.filter((combo) => publishedIds.has(combo.id)).length}/{combos.length} enabled
                  </span>
                  {" — only enabled routes appear in Models and accept requests."}
                </>
              )}
            </p>
            <Button icon="add" onClick={() => setShowCreateModal(true)} className="w-full whitespace-nowrap sm:w-auto">
              Create Route
            </Button>
          </div>

          {/* Model Routes Table */}
          {combos.length === 0 ? (
            <Card>
              <div className="py-12 text-center">
                <div className="mb-4 inline-flex size-16 items-center justify-center border border-border bg-surface-2 text-text-main">
                  <span className="material-symbols-outlined text-3xl">layers</span>
                </div>
                <p className="mb-1 font-medium text-text-main">No model routes yet</p>
                <p className="mb-4 text-sm text-text-muted">Create a public model route with fallback support</p>
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] table-fixed text-left text-sm">
                  <thead className="border-b border-border">
                    <tr className="font-mono text-[11px] uppercase tracking-wide text-text-muted">
                      <th className="w-[64px] px-3 py-2 font-medium">On</th>
                      <th className="w-[24%] px-3 py-2 font-medium">Route</th>
                      <th className="w-[24%] px-2 py-2 font-medium">Members</th>
                      <th className="w-[32%] px-2 py-2 font-medium">Strategy</th>
                      <th className="w-[16%] px-2 py-2 text-right font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {combos.map((combo, index) => (
                      <ComboTableRow
                        key={combo.id}
                        combo={combo}
                        index={index}
                        published={publishedIds.has(combo.id)}
                        publishing={publishingId === combo.id}
                        onTogglePublished={(enabled) => handleTogglePublished(combo, enabled)}
                        modelProvider={modelProviders.find((provider) => provider.name.toLowerCase() === String(combo.modelProvider || "").toLowerCase())}
                        copied={copied}
                        onCopy={copy}
                        onEdit={() => setEditingCombo(combo)}
                        onDelete={() => handleDelete(combo.id)}
                        strategy={comboStrategies[combo.name] || {}}
                        onSetStrategy={(patch) => handleSetComboStrategy(combo.name, patch)}
                        onSelectJudge={() => setJudgeCombo(combo)}
                        testState={comboTests[combo.id]}
                        onTest={(overrides) => handleTestCombo(combo, overrides)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

      {/* Create Modal - Use key to force remount and reset state */}
      {showCreateModal && (
        <ComboFormModal
          key="create"
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreate}
          activeProviders={activeProviders}
          modelProviders={modelProviders}
        />
      )}

      {editingCombo && (
        <ComboFormModal
          key={editingCombo.id}
          isOpen={!!editingCombo}
          combo={editingCombo}
          onClose={() => setEditingCombo(null)}
          onSave={(data) => handleUpdate(editingCombo.id, data)}
          activeProviders={activeProviders}
          modelProviders={modelProviders}
          strategy={comboStrategies[editingCombo.name] || {}}
          testState={comboTests[editingCombo.id]}
          onTest={(overrides) => handleTestCombo(editingCombo, overrides)}
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

const STRATEGY_OPTIONS = [
  { value: "fallback", label: "Fallback" },
  { value: "round-robin", label: "Round Robin" },
  { value: "fusion", label: "Fusion" },
];
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
          <h2 className="font-mono text-base font-semibold text-text-main">Virtual Providers</h2>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
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
          <span className="material-symbols-outlined text-4xl text-text-subtle">category</span>
          <h3 className="mt-3 font-mono text-sm font-semibold text-text-main">No virtual providers</h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-text-muted">
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
                    <p className="truncate font-mono text-sm font-semibold text-text-main">{provider.name}</p>
                    <p className="truncate font-mono text-[11px] text-text-muted">
                      lobehub.com/icons/{provider.iconKey} · {routes} route{routes === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFormState({ provider })}
                      className="inline-flex size-8 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      aria-label={`Settings for ${provider.name}`}
                      title="Provider settings"
                    >
                      <span className="material-symbols-outlined text-[18px]">settings</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingProvider(provider)}
                      disabled={routes > 0}
                      className="inline-flex size-8 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={`Delete ${provider.name}`}
                      title={routes > 0 ? "Remove this provider from all routes before deleting it" : "Delete provider"}
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
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
      footer={null}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 border border-border bg-surface-2 px-3 py-3">
          <LobeProviderIcon iconKey={iconKey} name={name || "Provider"} className="size-10" />
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-semibold text-text-main">
              {name.trim() || "Provider preview"}
            </p>
            <p className="truncate font-mono text-[11px] text-text-muted">
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

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="ghost" fullWidth size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            fullWidth
            size="sm"
            onClick={handleSave}
            loading={saving}
            disabled={!name.trim() || !iconKey || saving}
          >
            {isEdit ? "Save provider" : "Add provider"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}


function TestStateMark({ model, result }) {
  const state = result?.state || "pending";
  const presentation = {
    pending: { icon: "progress_activity", color: "text-primary", label: "Testing", spin: true },
    success: { icon: "check_circle", color: "text-success", label: "Passed", spin: false },
    failed: { icon: "cancel", color: "text-danger", label: "Failed", spin: false },
    skipped: { icon: "remove_circle_outline", color: "text-text-subtle", label: "Skipped", spin: false },
  }[state];
  const detail = result?.error
    ? `${presentation.label}: ${result.error}`
    : result?.latencyMs != null
      ? `${presentation.label} in ${result.latencyMs}ms`
      : presentation.label;

  return (
    <span
      className="inline-flex min-w-0 max-w-64 items-center gap-1.5 border border-border bg-surface-1 px-2 py-1"
      title={`${model} — ${detail}`}
    >
      <span className={`material-symbols-outlined shrink-0 text-sm ${presentation.color} ${presentation.spin ? "animate-spin" : ""}`}>
        {presentation.icon}
      </span>
      <code className="truncate font-mono text-[11px] text-text-main">{model}</code>
      {result?.attemptOrder && (
        <span className="shrink-0 font-mono text-[11px] text-text-subtle">#{result.attemptOrder}</span>
      )}
    </span>
  );
}

function RouteTestDetails({ combo, testState }) {
  if (!testState) return null;
  const resultsByIndex = new Map((testState.results || []).map((result) => [result.index, result]));
  const strategyLabel = STRATEGY_OPTIONS.find((option) => option.value === testState.strategy)?.label || testState.strategy;

  return (
    <tr className="border-b border-border/60 bg-surface-2/40">
      <td colSpan={5} className="px-3 py-2">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
            <span className="uppercase tracking-wide text-text-muted">{strategyLabel} test</span>
            {testState.testing ? (
              <span className="text-primary">Running strategy path…</span>
            ) : testState.error ? (
              <span className="text-danger">{testState.error}</span>
            ) : (
              <span className={testState.ok ? "text-success" : "text-danger"}>{testState.message}</span>
            )}
          </div>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {combo.models.map((model, index) => (
              <TestStateMark
                key={`${model}-${index}`}
                model={model}
                result={testState.testing ? null : resultsByIndex.get(index)}
              />
            ))}
            {testState.judge && (
              <>
                <span className="self-center font-mono text-[11px] uppercase tracking-wide text-text-subtle">Judge</span>
                <TestStateMark model={testState.judge.model} result={testState.judge} />
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function ComboTableRow({
  combo,
  index,
  modelProvider,
  published = false,
  publishing = false,
  onTogglePublished,
  copied,
  onCopy,
  onEdit,
  onDelete,
  strategy = {},
  onSetStrategy,
  onSelectJudge,
  testState,
  onTest,
}) {
  const current = strategy.fallbackStrategy || "fallback";
  const judge = strategy.judgeModel || "";
  const isFusion = current === "fusion";
  const firstModel = combo.models[0];
  const overflowModels = Math.max(combo.models.length - 1, 0);
  // Publishing requires an owner and at least one routed member (enforced server-side too).
  const publishable = Boolean(String(combo.modelProvider || "").trim()) && combo.models.length > 0;
  const toggleTitle = !publishable
    ? "Set a model provider and add at least one routed model before enabling this route"
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
        className={`group transition-colors hover:bg-surface-2/60 ${index % 2 === 1 ? "bg-surface-2/30" : ""} ${
          published ? "" : "opacity-50 hover:opacity-100"
        }`}
      >
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
        <td className="px-3 py-2 align-middle">
          <div className="flex min-w-0 items-center gap-2">
            <LobeProviderIcon
              iconKey={modelProvider?.iconKey}
              name={combo.modelProvider || combo.name}
              className="size-7"
            />
            <span className="min-w-0">
              <code className="block truncate font-mono text-sm font-medium text-text-main" title={combo.name}>
                {combo.name}
              </code>
              <span className={`block truncate font-mono text-[11px] uppercase tracking-wide ${combo.modelProvider ? "text-text-muted" : "text-danger"}`}>
                {combo.modelProvider || "Provider not set"}
              </span>
            </span>
          </div>
        </td>
        <td className="px-2 py-2 align-middle" title={combo.models.join("\n")}>
          {firstModel ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <code className="block min-w-0 truncate font-mono text-[11px] text-text-main">
                {firstModel}
              </code>
              {overflowModels > 0 && (
                <span className="shrink-0 font-mono text-[11px] text-text-muted">+{overflowModels}</span>
              )}
            </div>
          ) : (
            <span className="font-mono text-xs text-text-subtle">—</span>
          )}
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
                  <span className="material-symbols-outlined shrink-0 text-sm">gavel</span>
                  <span className="truncate">{judge || "Auto"}</span>
                </button>
                {judge && (
                  <button
                    type="button"
                    onClick={() => onSetStrategy({ judgeModel: "" })}
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    title="Reset judge to Auto"
                    aria-label={`Reset judge for ${combo.name}`}
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </>
            )}
          </div>
        </td>
        <td className="px-2 py-2 text-right align-middle">
          <div className="flex items-center justify-end gap-0.5">
            <button
              type="button"
              onClick={() => onTest({ strategy: current, judgeModel: judge })}
              disabled={testState?.testing || combo.models.length === 0}
              className={`inline-flex size-7 items-center justify-center rounded-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                testState?.ok === true
                  ? "text-success hover:bg-success/10"
                  : testState?.ok === false
                    ? "text-danger hover:bg-danger/10"
                    : "text-text-muted hover:bg-primary/10 hover:text-primary"
              }`}
              title={`Test ${current} route`}
              aria-label={`Test ${combo.name}`}
            >
              <span className={`material-symbols-outlined text-base ${testState?.testing ? "animate-spin" : ""}`}>
                {testIcon}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onCopy(combo.name, `combo-${combo.id}`)}
              className="inline-flex size-7 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main"
              title="Copy model route ID"
              aria-label={`Copy model route ID ${combo.name}`}
            >
              <span className="material-symbols-outlined text-base">
                {copied === `combo-${combo.id}` ? "check" : "content_copy"}
              </span>
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex size-7 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main"
              title="Edit route"
              aria-label={`Edit ${combo.name}`}
            >
              <span className="material-symbols-outlined text-base">edit</span>
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex size-7 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
              title="Delete route"
              aria-label={`Delete ${combo.name}`}
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          </div>
        </td>
      </tr>
      <RouteTestDetails combo={combo} testState={testState} />
    </>
  );
}

function ModelItem({ id, index, model, isFirst, isLast, testResult, onEdit, onMoveUp, onMoveDown, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    // no transition — prevents the CSS settle animation fighting React's re-render on drop
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(model);
  const testPresentation = testResult && {
    pending: { icon: "progress_activity", color: "text-primary", label: "Testing", spin: true },
    success: { icon: "check_circle", color: "text-success", label: "Passed", spin: false },
    failed: { icon: "cancel", color: "text-danger", label: "Failed", spin: false },
    skipped: { icon: "remove_circle_outline", color: "text-text-subtle", label: "Skipped", spin: false },
  }[testResult.state];
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== model) onEdit(trimmed);
    else setDraft(model);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { setDraft(model); setEditing(false); }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex min-w-0 items-center gap-1.5 rounded-sm px-2 py-1 bg-black/[0.02] hover:bg-black/[0.04] dark:bg-white/[0.02] dark:hover:bg-white/[0.04] transition-colors ${isDragging ? "ring-1 ring-primary/30" : ""}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="cursor-grab touch-none p-0.5 rounded text-text-muted hover:text-primary active:cursor-grabbing shrink-0"
        title="Drag to reorder"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="4" r="2"/><circle cx="15" cy="4" r="2"/>
          <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="20" r="2"/><circle cx="15" cy="20" r="2"/>
        </svg>
      </button>

      {/* Index badge */}
      <span className="text-[10px] font-medium text-text-muted w-3 text-center shrink-0">{index + 1}</span>
      {testPresentation && (
        <span
          className={`material-symbols-outlined shrink-0 text-sm ${testPresentation.color} ${testPresentation.spin ? "animate-spin" : ""}`}
          title={testResult.error || `${testPresentation.label}${testResult.latencyMs != null ? ` in ${testResult.latencyMs}ms` : ""}`}
        >
          {testPresentation.icon}
        </span>
      )}

      {/* Inline editable model value */}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 rounded border border-primary/40 bg-white px-1.5 py-0.5 font-mono text-xs text-text-main outline-none dark:bg-black/20"
        />
      ) : (
        <div
          className="min-w-0 flex-1 cursor-text truncate rounded px-1.5 py-0.5 font-mono text-xs text-text-main hover:bg-black/5 dark:hover:bg-white/5"
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {model}
        </div>
      )}

      {/* Priority arrows */}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className={`p-0.5 rounded ${isFirst ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5"}`}
          title="Move up"
        >
          <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className={`p-0.5 rounded ${isLast ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5"}`}
          title="Move down"
        >
          <span className="material-symbols-outlined text-[12px]">arrow_downward</span>
        </button>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="p-0.5 hover:bg-red-500/10 rounded text-text-muted hover:text-red-500 transition-all"
        title="Remove"
      >
        <span className="material-symbols-outlined text-[12px]">close</span>
      </button>
    </div>
  );
}

function ComboFormModal({
  isOpen,
  combo,
  onClose,
  onSave,
  onTest,
  strategy = {},
  testState,
  activeProviders,
  modelProviders = [],
  kindFilter = null,
}) {
  // Initialize state with combo values - key prop on parent handles reset on remount
  const [name, setName] = useState(combo?.name || "");
  const [models, setModels] = useState(combo?.models || []);
  const [modelProvider, setModelProvider] = useState(combo?.modelProvider || "");
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [providerError, setProviderError] = useState("");
  const [modelAliases, setModelAliases] = useState({});
  const [showJudgeSelect, setShowJudgeSelect] = useState(false);
  const [testStrategy, setTestStrategy] = useState(strategy.fallbackStrategy || "fallback");
  const [testJudge, setTestJudge] = useState(strategy.judgeModel || "");
  const [modalTestState, setModalTestState] = useState(testState || null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Use stable index-based IDs so duplicates and similar names are handled correctly
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

  const fetchModalData = async () => {
    try {
      const aliasesRes = await fetch("/api/models/alias");
      if (!aliasesRes.ok) return;
      const aliasesData = await aliasesRes.json();
      setModelAliases(aliasesData.aliases || {});
    } catch (error) {
      console.error("Error fetching modal data:", error);
    }
  };

  useEffect(() => {
    if (isOpen) fetchModalData();
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

  const handleDeselectModel = (model) => {
    setModels(models.filter((m) => m !== model.value));
  };

  const handleRemoveModel = (index) => {
    setModels(models.filter((_, i) => i !== index));
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

  const handleSave = async () => {
    if (!validateName(name)) return;
    const normalizedProvider = modelProvider.trim();
    if (!normalizedProvider) {
      setProviderError("Model provider is required before this combo can be published");
      return;
    }
    setProviderError("");
    setSaving(true);
    await onSave({ name: name.trim(), models, modelProvider: normalizedProvider });
    setSaving(false);
  };

  const handleRunTest = async () => {
    const testedModels = [...models];
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

  const isEdit = !!combo;
  const modalResultsByIndex = new Map((modalTestState?.results || []).map((result) => [result.index, result]));

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? "Edit Model Route" : "Create Model Route"}
      >
        <div className="flex flex-col gap-3">
          {/* Name */}
          <div>
            <Input
              label="Combo Name"
              value={name}
              onChange={handleNameChange}
              placeholder="my-combo"
              error={nameError}
            />
            <p className="text-[10px] text-text-muted mt-0.5">
              Only letters, numbers, -, _ and . allowed
            </p>
          </div>

          {/* Public model ownership */}
          <div>
            <label className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Model Provider <span className="text-danger">*</span>
            </label>
            <Select
              value={modelProvider}
              onChange={(event) => {
                setModelProvider(event.target.value);
                if (event.target.value) setProviderError("");
              }}
              disabled={modelProviders.length === 0}
              options={[
                ...(modelProvider && !modelProviders.some((provider) => provider.name === modelProvider)
                  ? [{ value: modelProvider, label: `${modelProvider} (legacy)` }]
                  : []),
                ...modelProviders.map((provider) => ({ value: provider.name, label: provider.name })),
              ]}
            />
            {providerError ? (
              <p className="mt-1 font-mono text-xs text-danger">{providerError}</p>
            ) : (
              <p className="mt-1 text-xs text-text-muted">
                {modelProviders.length > 0
                  ? "Shown as owned_by in /v1/models."
                  : "Create a provider in the Providers tab first."}
              </p>
            )}
          </div>

          {/* Models */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Models</label>

            {models.length === 0 ? (
              <div className="text-center py-4 border border-dashed border-black/10 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.01]">
                <span className="material-symbols-outlined text-text-muted text-xl mb-1">layers</span>
                <p className="text-xs text-text-muted">No models added yet</p>
              </div>
            ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
              <SortableContext items={modelItems.map((m) => m.uid)} strategy={verticalListSortingStrategy}>
                <div className="flex max-h-[55vh] min-w-0 flex-col gap-1 overflow-y-auto sm:max-h-[350px]">
                  {modelItems.map(({ uid, model }, index) => (
                    <ModelItem
                      key={uid}
                      id={uid}
                      index={index}
                      model={model}
                      isFirst={index === 0}
                      isLast={index === modelItems.length - 1}
                      testResult={
                        modalTestState?.testedModels?.[index] === model
                          ? modalTestState.testing
                            ? { state: "pending" }
                            : modalResultsByIndex.get(index)
                          : null
                      }
                      onEdit={(newVal) => {
                        const updated = [...models];
                        updated[index] = newVal;
                        setModels(updated);
                      }}
                      onMoveUp={() => handleMoveUp(index)}
                      onMoveDown={() => handleMoveDown(index)}
                      onRemove={() => handleRemoveModel(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            )}

            {/* Add Model button */}
            <button
              onClick={() => setShowModelSelect(true)}
              className="w-full mt-2 py-2 border border-dashed border-black/10 dark:border-white/10 rounded-sm text-xs text-primary font-medium hover:text-primary hover:border-primary/50 transition-colors flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add Model
            </button>
          </div>

          {isEdit && onTest && (
            <div className="border-y border-border py-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium text-text-main">Test route</span>
                  <span className="block text-xs text-text-muted">Run the current model list through one strategy path.</span>
                </span>
                {modalTestState && !modalTestState.testing && (
                  <span className={`font-mono text-[11px] uppercase tracking-wide ${modalTestState.ok ? "text-success" : "text-danger"}`}>
                    {modalTestState.ok ? "Passed" : "Failed"}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Select
                    label="Test strategy"
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
                    className="inline-flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-sm border border-dashed border-primary/40 px-3 font-mono text-xs text-primary transition-colors hover:border-primary hover:bg-primary/5"
                    title={testJudge ? `Judge: ${testJudge}` : `Auto judge: ${models[0] || "first model"}`}
                  >
                    <span className="material-symbols-outlined text-sm">gavel</span>
                    <span className="truncate">{testJudge || "Auto judge"}</span>
                  </button>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={handleRunTest}
                  loading={modalTestState?.testing}
                  disabled={models.length === 0 || modalTestState?.testing}
                >
                  Test
                </Button>
              </div>
              {modalTestState && !modalTestState.testing && (
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                  <span className={`min-w-0 font-mono text-[11px] ${modalTestState.ok ? "text-success" : "text-danger"}`}>
                    {modalTestState.error || modalTestState.message}
                  </span>
                  {modalTestState.judge && (
                    <TestStateMark model={`Judge: ${modalTestState.judge.model}`} result={modalTestState.judge} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Button onClick={onClose} variant="ghost" fullWidth size="sm">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              fullWidth
              size="sm"
              disabled={!name.trim() || !modelProvider.trim() || !!nameError || saving}
            >
              {saving ? "Saving..." : isEdit ? "Save route" : "Create route"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Model Select Modal */}
      {showModelSelect && (
        <ModelSelectModal
          isOpen={showModelSelect}
          onClose={() => setShowModelSelect(false)}
          onSelect={handleAddModel}
          onDeselect={handleDeselectModel}
          activeProviders={activeProviders}
          modelAliases={modelAliases}
          title="Add Model to Combo"
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
