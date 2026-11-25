"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import Input from "./Input";
import Button from "./Button";
import ModelSelectModal from "./ModelSelectModal";
import { Icon } from "@/shared/components/ui/icon";

const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

// Inline editable model item
function ModelItem({ index, model, isFirst, isLast, onEdit, onMoveUp, onMoveDown, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(model);

  useEffect(() => {
    setDraft(model);
  }, [model]);

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
    <div className="group flex min-w-0 items-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 transition-colors hover:bg-muted/40">
      <span className="w-4 shrink-0 text-center text-[11px] font-medium text-muted-foreground tabular-nums">
        {index + 1}
      </span>
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
          className="min-w-0 flex-1 cursor-text truncate rounded px-1.5 py-0.5 font-mono text-xs text-foreground hover:bg-accent/60"
          onClick={() => setEditing(true)}
          title="Click to edit model ID"
        >
          {model}
        </div>
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          className={`rounded p-1 transition-colors ${isFirst ? "cursor-not-allowed text-muted-foreground/25" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          title="Move up"
          aria-label="Move model up"
        >
          <Icon name="arrow_upward" className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          className={`rounded p-1 transition-colors ${isLast ? "cursor-not-allowed text-muted-foreground/25" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          title="Move down"
          aria-label="Move model down"
        >
          <Icon name="arrow_downward" className="size-3.5" />
        </button>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        title="Remove"
        aria-label="Remove model"
      >
        <Icon name="close" className="size-3.5" />
      </button>
    </div>
  );
}

// Reusable Combo create/edit modal. forcePrefix auto-prepends to name.
export default function ComboFormModal({
  isOpen,
  combo,
  onClose,
  onSave,
  activeProviders,
  kindFilter = null,
  forcePrefix = "",
  title,
}) {
  // Strip prefix when editing existing combo so user only edits suffix
  const initialName = combo?.name
    ? forcePrefix && combo.name.startsWith(forcePrefix)
      ? combo.name.slice(forcePrefix.length)
      : combo.name
    : "";
  const [name, setName] = useState(initialName);
  const [models, setModels] = useState(combo?.models || []);
  const [manualModel, setManualModel] = useState("");
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [modelAliases, setModelAliases] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/models/alias")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setModelAliases(d.aliases || {}))
      .catch(() => {});
  }, [isOpen]);

  const validateName = (value) => {
    if (!value.trim()) {
      setNameError("Name is required");
      return false;
    }
    const full = forcePrefix + value;
    if (!VALID_NAME_REGEX.test(full)) {
      setNameError("Only letters, numbers, -, _ and . allowed");
      return false;
    }
    setNameError("");
    return true;
  };

  const handleNameChange = (e) => {
    let value = e.target.value;
    // If user types prefix manually, strip it (we always prepend)
    if (forcePrefix && value.startsWith(forcePrefix)) value = value.slice(forcePrefix.length);
    setName(value);
    if (value) validateName(value);
    else setNameError("");
  };

  const handleAddModel = (model) => {
    if (!models.includes(model.value)) setModels([...models, model.value]);
  };
  const handleAddManualModel = () => {
    const trimmed = manualModel.trim();
    if (!trimmed) return;
    if (!models.includes(trimmed)) setModels((prev) => [...prev, trimmed]);
    setManualModel("");
  };
  const handleDeselectModel = (model) => {
    setModels(models.filter((m) => m !== model.value));
  };
  const handleRemoveModel = (i) => setModels(models.filter((_, idx) => idx !== i));
  const handleMoveUp = (i) => {
    if (i === 0) return;
    const a = [...models];
    [a[i - 1], a[i]] = [a[i], a[i - 1]];
    setModels(a);
  };
  const handleMoveDown = (i) => {
    if (i === models.length - 1) return;
    const a = [...models];
    [a[i], a[i + 1]] = [a[i + 1], a[i]];
    setModels(a);
  };

  const handleSave = async () => {
    if (!validateName(name)) return;
    setSaving(true);
    try {
      await onSave({ name: forcePrefix + name.trim(), models });
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!combo;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title || (isEdit ? "Edit Combo" : "Create Combo")}
        size="lg"
        footer={
          <>
            <Button onClick={onClose} variant="outline" disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || !!nameError || saving} loading={saving}>
              {isEdit ? "Save changes" : "Create combo"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            {forcePrefix ? (
              <>
                <label className="mb-1.5 block text-sm font-medium">Combo Name</label>
                <div className="flex items-stretch">
                  <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted/60 px-2.5 font-mono text-sm text-muted-foreground">
                    {forcePrefix}
                  </span>
                  <input
                    value={name}
                    onChange={handleNameChange}
                    placeholder="my-combo"
                    className="min-w-0 flex-1 rounded-r-md border border-input bg-background px-3 py-1.5 font-mono text-sm outline-none focus:border-ring"
                  />
                </div>
                {nameError && <p className="mt-1 text-xs text-destructive">{nameError}</p>}
              </>
            ) : (
              <Input
                label="Combo Name"
                value={name}
                onChange={handleNameChange}
                placeholder="my-combo"
                error={nameError}
              />
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {forcePrefix ? `Auto-prefixed with "${forcePrefix}". ` : ""}Only letters, numbers, -, _ and . allowed
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="text-sm font-medium">Models ({models.length})</label>
              <Button
                type="button"
                variant="outline"
                size="xs"
                icon="add"
                onClick={() => setShowModelSelect(true)}
              >
                Browse models
              </Button>
            </div>
            {models.length === 0 ? (
              <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-muted/15 py-5 text-center">
                <Icon name="layers" className="mb-1 size-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">No models added yet</p>
              </div>
            ) : (
              <div className="flex max-h-[45vh] min-w-0 flex-col gap-1.5 overflow-y-auto sm:max-h-[300px]">
                {models.map((model, index) => (
                  <ModelItem
                    key={`${model}-${index}`}
                    index={index}
                    model={model}
                    isFirst={index === 0}
                    isLast={index === models.length - 1}
                    onEdit={(v) => {
                      const a = [...models];
                      a[index] = v;
                      setModels(a);
                    }}
                    onMoveUp={() => handleMoveUp(index)}
                    onMoveDown={() => handleMoveDown(index)}
                    onRemove={() => handleRemoveModel(index)}
                  />
                ))}
              </div>
            )}

            <div className="mt-2.5 flex items-center gap-2">
              <input
                type="text"
                value={manualModel}
                onChange={(e) => setManualModel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
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
                disabled={!manualModel.trim()}
              >
                Add
              </Button>
            </div>
          </div>
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
          title="Add Model to Combo"
          kindFilter={kindFilter}
          addedModelValues={models}
          closeOnSelect={false}
        />
      )}
    </>
  );
}
