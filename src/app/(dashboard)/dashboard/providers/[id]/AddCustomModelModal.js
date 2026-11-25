"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Icon } from "@/shared/components/ui/icon";
import { Button, Modal, Select, Toggle } from "@/shared/components";
import { CAPACITY_META, STT_TRANSPORT_META, STT_TRANSPORTS } from "@/shared/constants/models";

const defaultCaps = () => Object.fromEntries(Object.keys(CAPACITY_META).map((key) => [key, false]));

export default function AddCustomModelModal({ isOpen, providerAlias, providerDisplayAlias, onSave, onClose }) {
  const [modelId, setModelId] = useState("");
  const [caps, setCaps] = useState(defaultCaps);
  const [modelType, setModelType] = useState("llm");
  const [testStatus, setTestStatus] = useState(null); // null | "testing" | "ok" | "error"
  const [testError, setTestError] = useState("");
  const [saving, setSaving] = useState(false);
  // Realtime dispatch marker for the transport select; "" = provider default REST.
  const [transport, setTransport] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setModelId("");
      setCaps(defaultCaps());
      setModelType("llm");
      setTransport("");
      setTestStatus(null);
      setTestError("");
    }
  }, [isOpen]);

  // Strip provider's own alias prefix (e.g. "cc/model" -> "model" for cc provider)
  const stripAlias = (id) => {
    const prefix = `${providerAlias}/`;
    return id.startsWith(prefix) ? id.slice(prefix.length) : id;
  };

  const handleTest = async () => {
    const cleanId = stripAlias(modelId.trim());
    if (!cleanId) return;
    setTestStatus("testing");
    setTestError("");
    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: `${providerAlias}/${cleanId}`, kind: modelType }),
      });
      const data = await res.json();
      setTestStatus(data.ok ? "ok" : "error");
      setTestError(data.error || "");
    } catch (err) {
      setTestStatus("error");
      setTestError(err.message);
    }
  };

  const handleSave = async () => {
    const cleanId = stripAlias(modelId.trim());
    if (!cleanId || saving) return;
    setSaving(true);
    try {
      await onSave(cleanId, modelType, modelType === "llm" ? caps : undefined, modelType === "stt" ? transport : null);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleTest();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Custom Model"
      size="lg"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button type="button" onClick={onClose} variant="outline" size="sm">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            size="sm"
            disabled={!modelId.trim() || saving}
          >
            {saving ? "Adding..." : "Add Model"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label="Model type"
          value={modelType}
          options={[
            { value: "llm", label: "Chat / LLM" },
            { value: "stt", label: "Speech to text (STT)" },
          ]}
          onChange={(e) => {
            setModelType(e.target.value);
            setCaps(defaultCaps());
            setTransport("");
            setTestStatus(null);
            setTestError("");
          }}
          disabled={saving || testStatus === "testing"}
          hint={modelType === "llm"
            ? "Chat models appear in this provider's Available Models."
            : "Audio transcription models use /v1/audio/transcriptions."}
        />
        <div>
          <label className="text-sm font-medium mb-1.5 block">Model ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={modelId}
              onChange={(e) => { setModelId(e.target.value); setTestStatus(null); setTestError(""); }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. claude-opus-4-5"
              className="flex-1 min-w-0 px-3 py-2 text-sm border border-border rounded-md bg-background font-mono focus:outline-none focus:border-primary"
              autoFocus
            />
            <Button
              type="button"
              variant="secondary"
              icon="science"
              loading={testStatus === "testing"}
              onClick={handleTest}
              disabled={!modelId.trim() || testStatus === "testing"}
            >
              {testStatus === "testing" ? "Testing..." : "Test"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Sent to provider as:{" "}
            <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{stripAlias(modelId.trim()) || "model-id"}</code>
          </p>
        </div>

        {modelType === "llm" && (
          <div>
            <label className="text-sm font-medium mb-2 block">Capabilities</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {Object.entries(CAPACITY_META).map(([key, meta]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground">{meta.label}</div>
                    {meta.desc && <div className="text-[11px] text-muted-foreground truncate">{meta.desc}</div>}
                  </div>
                  <Toggle
                    checked={!!caps[key]}
                    onChange={(v) => setCaps((prev) => ({ ...prev, [key]: v }))}
                    ariaLabel={meta.label}
                    size="sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {modelType === "stt" && (
          <Select
            label="Transport"
            value={transport}
            onChange={(e) => setTransport(e.target.value)}
            placeholder="Provider default (REST)"
            options={STT_TRANSPORTS.map((t) => ({ value: t, label: STT_TRANSPORT_META[t].label }))}
            hint="Realtime transport marker for the STT dispatcher. Empty keeps the provider's REST format."
          />
        )}

        {/* Test result */}
        {testStatus === "ok" && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <Icon name="check_circle" className="size-4 shrink-0" />
            Model is reachable
          </div>
        )}
        {testStatus === "error" && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <Icon name="cancel" className="size-4 shrink-0 mt-0.5" />
            <span className="break-words">{testError || "Model not reachable"}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

AddCustomModelModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  providerAlias: PropTypes.string.isRequired,
  providerDisplayAlias: PropTypes.string.isRequired,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
