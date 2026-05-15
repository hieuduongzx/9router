"use client";

import { useState, useEffect, useCallback } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { Card, Button, Modal, Input, CardSkeleton, ModelSelectModal, Toggle, ConfirmModal } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

// Validate combo name: only a-z, A-Z, 0-9, -, _
const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

export default function CombosPage() {
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState(null);
  const [duplicatingCombo, setDuplicatingCombo] = useState(null);
  const [activeProviders, setActiveProviders] = useState([]);
  const [comboStrategies, setComboStrategies] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const { copied, copy } = useCopyToClipboard();

  const visibleCombos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = combos.filter((combo) => {
      if (!query) return true;
      return (
        combo.name?.toLowerCase().includes(query) ||
        combo.models?.some((model) => model.toLowerCase().includes(query))
      );
    });

    return [...filtered].sort((a, b) => {
      let result = 0;
      if (sortField === "models") {
        result = (a.models?.length || 0) - (b.models?.length || 0);
      } else if (sortField === "strategy") {
        const strategyA = comboStrategies[a.name]?.fallbackStrategy || "fallback";
        const strategyB = comboStrategies[b.name]?.fallbackStrategy || "fallback";
        result = strategyA.localeCompare(strategyB);
      } else {
        result = (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
      }
      return sortDirection === "asc" ? result : -result;
    });
  }, [combos, comboStrategies, searchQuery, sortDirection, sortField]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }
    setSortField(field);
    setSortDirection("asc");
  };

  const sortLabel = sortDirection === "asc" ? "ascending" : "descending";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [combosRes, providersRes, settingsRes] = await Promise.all([
        fetch("/api/combos"),
        fetch("/api/providers"),
        fetch("/api/settings"),
      ]);
      const combosData = await combosRes.json();
      const providersData = await providersRes.json();
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};
      
      if (combosRes.ok) setCombos(combosData.combos || []);
      if (providersRes.ok) {
        setActiveProviders(providersData.connections || []);
      }
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
    if (!confirm("Delete this combo?")) return;
    try {
      const res = await fetch(`/api/combos/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCombos(combos.filter(c => c.id !== id));
      }
    } catch (error) {
      console.log("Error deleting combo:", error);
    }
  };

  const handleToggleRoundRobin = async (comboName, enabled) => {
    try {
      const updated = { ...comboStrategies };
      if (enabled) {
        updated[comboName] = { fallbackStrategy: "round-robin" };
      } else {
        delete updated[comboName];
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

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Combos</h1>
          <p className="text-sm text-text-muted mt-1">
            Create model combos with fallback support
          </p>
        </div>
        <Button icon="add" onClick={() => setShowCreateModal(true)}>
          Create Combo
        </Button>
      </div>

      <Card padding="sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search combos or models..."
            icon="search"
            className="w-full"
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
          <span>
            Showing {visibleCombos.length} of {combos.length} combos
          </span>
          <span className="hidden sm:inline">
            Sorted by {sortField} ({sortLabel})
          </span>
        </div>
      </Card>

      {/* Combos List */}
      {combos.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
              <span className="material-symbols-outlined text-[32px]">layers</span>
            </div>
            <p className="text-text-main font-medium mb-1">No combos yet</p>
            <p className="text-sm text-text-muted mb-4">Create model combos with fallback support</p>
            <Button icon="add" onClick={() => setShowCreateModal(true)}>
              Create Combo
            </Button>
          </div>
        </Card>
      ) : visibleCombos.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <p className="text-text-main font-medium mb-1">No combos match your search</p>
            <p className="text-sm text-text-muted">Try a different combo name or model keyword.</p>
          </div>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_170px_180px] gap-6 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted dark:border-zinc-800 dark:bg-zinc-900/60">
            <button onClick={() => handleSort("name")} className="flex items-center gap-1 text-left hover:text-primary">
              Combo {sortField === "name" && <SortIcon direction={sortDirection} />}
            </button>
            <span>Models</span>
            <button onClick={() => handleSort("strategy")} className="flex items-center gap-1 text-left hover:text-primary">
              Strategy {sortField === "strategy" && <SortIcon direction={sortDirection} />}
            </button>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {visibleCombos.map((combo) => (
              <ComboListRow
                key={combo.id}
                combo={combo}
                copied={copied}
                onCopy={copy}
                onEdit={() => setEditingCombo(combo)}
                onDuplicate={() => setDuplicatingCombo({ ...combo, name: `${combo.name}-copy` })}
                onDelete={() => handleDelete(combo.id)}
                roundRobinEnabled={comboStrategies[combo.name]?.fallbackStrategy === "round-robin"}
                onToggleRoundRobin={(enabled) => handleToggleRoundRobin(combo.name, enabled)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Create Modal - Use key to force remount and reset state */}
      <ComboFormModal
        key="create"
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreate}
        activeProviders={activeProviders}
      />

      {/* Edit Modal - Use key to force remount and reset state */}
      <ComboFormModal
        key={editingCombo?.id || "new"}
        isOpen={!!editingCombo}
        combo={editingCombo}
        onClose={() => setEditingCombo(null)}
        onSave={(data) => handleUpdate(editingCombo.id, data)}
        activeProviders={activeProviders}
      />

      <ComboFormModal
        key={`duplicate-${duplicatingCombo?.id || "new"}`}
        isOpen={!!duplicatingCombo}
        combo={duplicatingCombo}
        duplicate
        onClose={() => setDuplicatingCombo(null)}
        onSave={async (data) => {
          await handleCreate(data);
          setDuplicatingCombo(null);
        }}
        activeProviders={activeProviders}
      />
    </div>
  );
}

function SortIcon({ direction }) {
  return (
    <span className="material-symbols-outlined text-[14px] leading-none">
      {direction === "asc" ? "arrow_upward" : "arrow_downward"}
    </span>
  );
}

function ComboListRow({ combo, copied, onCopy, onEdit, onDuplicate, onDelete, roundRobinEnabled, onToggleRoundRobin }) {
  const models = combo.models || [];

  return (
    <div className="grid gap-3 px-4 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/40 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_170px_180px] md:items-center md:gap-6">
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary text-[19px]">layers</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onCopy(combo.name, `combo-${combo.id}`); }}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
          title="Copy combo name"
        >
          <span className="material-symbols-outlined text-[18px]">
            {copied === `combo-${combo.id}` ? "check" : "content_copy"}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <code className="block truncate text-sm font-semibold font-mono text-text-main">{combo.name}</code>
          <span className="text-xs text-text-muted md:hidden">{models.length} models</span>
        </div>
      </div>

      <div className="min-w-0">
        {models.length === 0 ? (
          <span className="text-xs text-text-muted italic">No models</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {models.slice(0, 5).map((model, index) => (
              <code key={index} className="max-w-full truncate text-[11px] font-mono bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md text-text-muted">
                {model}
              </code>
            ))}
            {models.length > 5 && (
              <span className="text-[11px] text-text-muted px-2 py-1">+{models.length - 5} more</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Toggle
          size="sm"
          checked={roundRobinEnabled}
          onChange={onToggleRoundRobin}
        />
        <span className="text-xs font-medium text-text-muted">
          {roundRobinEnabled ? "Round Robin" : "Fallback"}
        </span>
      </div>

      <div className="flex items-center justify-start gap-1 md:justify-end">
        <ActionButton
          icon="difference"
          label="Duplicate"
          title="Duplicate combo"
          onClick={onDuplicate}
        />
        <ActionButton icon="edit" label="Edit" title="Edit" onClick={onEdit} />
        <ActionButton icon="delete" label="Delete" title="Delete" danger onClick={onDelete} />
      </div>
    </div>
  );
}

function ActionButton({ icon, label, title, danger = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
        danger
          ? "text-red-500 hover:bg-red-500/10"
          : "text-text-muted hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
      }`}
      title={title}
    >
      <span className="material-symbols-outlined text-[17px]">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function ModelItem({ id, index, model, isFirst, isLast, onEdit, onMoveUp, onMoveDown, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    // no transition — prevents the CSS settle animation fighting React's re-render on drop
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(model);
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
      className={`group flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 bg-black/[0.02] hover:bg-black/[0.04] dark:bg-white/[0.02] dark:hover:bg-white/[0.04] transition-colors ${isDragging ? "shadow-md ring-1 ring-primary/30" : ""}`}
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

      {/* Inline editable model value */}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 px-1.5 py-0.5 text-xs font-mono bg-white dark:bg-black/20 border border-primary/40 rounded outline-none text-text-main"
        />
      ) : (
        <div
          className="flex-1 min-w-0 px-1.5 py-0.5 text-xs font-mono text-text-main truncate cursor-text hover:bg-black/5 dark:hover:bg-white/5 rounded"
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {model}
        </div>
      )}

      {/* Priority arrows */}
      <div className="flex items-center gap-0.5">
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

function ComboFormModal({ isOpen, combo, duplicate = false, onClose, onSave, activeProviders, kindFilter = null }) {
  // Initialize state with combo values - key prop on parent handles reset on remount
  const [name, setName] = useState(combo?.name || "");
  const [models, setModels] = useState(combo?.models || []);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [modelAliases, setModelAliases] = useState({});

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

  useEffect(() => {
    if (!isOpen) return;

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

    fetchModalData();
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

  const handleDragEnter = (targetIndex) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    const newModels = [...models];
    const [draggedModel] = newModels.splice(draggedIndex, 1);
    newModels.splice(targetIndex, 0, draggedModel);
    setModels(newModels);
    setDraggedIndex(targetIndex);
  };

  const handleSave = async () => {
    if (!validateName(name)) return;
    setSaving(true);
    await onSave({ name: name.trim(), models });
    setSaving(false);
  };

  const isEdit = !!combo && !duplicate;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={duplicate ? "Duplicate Combo" : isEdit ? "Edit Combo" : "Create Combo"}
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

          {/* Models */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Models</label>

            {models.length === 0 ? (
              <div className="text-center py-4 border border-dashed border-black/10 dark:border-white/10 rounded-lg bg-black/[0.01] dark:bg-white/[0.01]">
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
              className="w-full mt-2 py-2 border border-dashed border-black/10 dark:border-white/10 rounded-lg text-xs text-primary font-medium hover:text-primary hover:border-primary/50 transition-colors flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add Model
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button onClick={onClose} variant="ghost" fullWidth size="sm">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              fullWidth
              size="sm"
              disabled={!name.trim() || !!nameError || saving}
            >
              {saving ? "Saving..." : isEdit ? "Save" : duplicate ? "Duplicate" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Model Select Modal */}
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
    </>
  );
}
