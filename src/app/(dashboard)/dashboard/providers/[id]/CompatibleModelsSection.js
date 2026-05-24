"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@/shared/components";
import ModelListView from "../components/ModelListView";

export default function CompatibleModelsSection({
  providerStorageAlias,
  providerDisplayAlias,
  modelAliases,
  copied,
  onCopy,
  onSetAlias,
  onDeleteAlias,
  connections,
  isAnthropic,
}) {
  const [newModel, setNewModel] = useState("");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [testingModelId, setTestingModelId] = useState(null);
  const [testingAllModels, setTestingAllModels] = useState(false);
  const [modelTestResults, setModelTestResults] = useState({});

  const providerAliases = Object.entries(modelAliases).filter(
    ([, model]) => model.startsWith(`${providerStorageAlias}/`),
  );

  const allModels = providerAliases.map(([alias, fullModel]) => ({
    modelId: fullModel.replace(`${providerStorageAlias}/`, ""),
    fullModel,
    alias,
  }));

  const runModelTest = async (modelId) => {
    const res = await fetch("/api/models/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: `${providerStorageAlias}/${modelId}` }),
    });
    const data = await res.json();
    setModelTestResults((prev) => ({ ...prev, [modelId]: data.ok ? "ok" : "error" }));
    return data;
  };

  const handleTestModel = async (modelId) => {
    if (testingModelId || testingAllModels) return;
    setTestingModelId(modelId);
    try {
      await runModelTest(modelId);
    } catch {
      setModelTestResults((prev) => ({ ...prev, [modelId]: "error" }));
    } finally {
      setTestingModelId(null);
    }
  };

  const handleTestAllModels = async () => {
    if (testingModelId || testingAllModels || allModels.length === 0) return;
    setTestingAllModels(true);
    try {
      const res = await fetch("/api/models/test-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          models: allModels.map(({ modelId }) => ({ id: modelId, model: `${providerStorageAlias}/${modelId}` })),
        }),
      });
      const data = await res.json();
      const results = data.results || [];
      setModelTestResults((prev) => ({
        ...prev,
        ...Object.fromEntries(results.map((result) => [result.id, result.ok ? "ok" : "error"])),
      }));
      if (!res.ok && results.length === 0) {
        setModelTestResults((prev) => ({
          ...prev,
          ...Object.fromEntries(allModels.map(({ modelId }) => [modelId, "error"])),
        }));
      }
    } catch {
      setModelTestResults((prev) => ({
        ...prev,
        ...Object.fromEntries(allModels.map(({ modelId }) => [modelId, "error"])),
      }));
    } finally {
      setTestingAllModels(false);
    }
  };

  const generateDefaultAlias = (modelId) => {
    const parts = modelId.split("/");
    return parts[parts.length - 1];
  };

  const resolveAlias = (modelId) => {
    const fullModel = `${providerStorageAlias}/${modelId}`;
    if (Object.values(modelAliases).includes(fullModel)) return null;
    const baseAlias = generateDefaultAlias(modelId);
    if (!modelAliases[baseAlias]) return baseAlias;
    const prefixedAlias = `${providerDisplayAlias}-${baseAlias}`;
    if (!modelAliases[prefixedAlias]) return prefixedAlias;
    return null;
  };

  const handleAdd = async () => {
    if (!newModel.trim() || adding) return;
    const modelId = newModel.trim();
    const resolvedAlias = resolveAlias(modelId);
    if (!resolvedAlias) {
      alert("All suggested aliases already exist. Please choose a different model or remove conflicting aliases.");
      return;
    }

    setAdding(true);
    try {
      await onSetAlias(modelId, resolvedAlias, providerStorageAlias);
      setNewModel("");
    } catch (error) {
      console.log("Error adding model:", error);
    } finally {
      setAdding(false);
    }
  };

  const handleImport = async () => {
    if (importing) return;
    const activeConnection = connections.find((conn) => conn.isActive !== false);
    if (!activeConnection) return;

    setImporting(true);
    try {
      const res = await fetch(`/api/providers/${activeConnection.id}/models`);
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to import models");
        return;
      }
      const models = data.models || [];
      if (models.length === 0) {
        alert("No models returned from /models.");
        return;
      }
      let importedCount = 0;
      for (const model of models) {
        const modelId = model.id || model.name || model.model;
        if (!modelId) continue;
        const resolvedAlias = resolveAlias(modelId);
        if (!resolvedAlias) continue;
        await onSetAlias(modelId, resolvedAlias, providerStorageAlias);
        importedCount += 1;
      }
      if (importedCount === 0) {
        alert("No new models were added.");
      }
    } catch (error) {
      console.log("Error importing models:", error);
    } finally {
      setImporting(false);
    }
  };

  const canImport = connections.some((conn) => conn.isActive !== false);

  // Build list items in the shared ModelListView shape
  const listItems = allModels.map(({ modelId, alias }) => ({
    id: modelId,
    fullModel: `${providerDisplayAlias}/${modelId}`,
    name: undefined,
    isCustom: true,
    isFree: false,
    testStatus: modelTestResults[modelId],
    onTest: () => handleTestModel(modelId),
    onRemove: () => onDeleteAlias(alias),
    removeTitle: "Remove model",
  }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Add {isAnthropic ? "Anthropic" : "OpenAI"}-compatible models manually or import them from the /models endpoint.
      </p>

      {/* Add / import / test toolbar */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[240px]">
          <label htmlFor="new-compatible-model-input" className="text-xs text-muted-foreground mb-1 block">
            Model ID
          </label>
          <input
            id="new-compatible-model-input"
            type="text"
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={isAnthropic ? "claude-3-opus-20240229" : "gpt-4o"}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Button size="sm" icon="add" onClick={handleAdd} disabled={!newModel.trim() || adding}>
          {adding ? "Adding..." : "Add"}
        </Button>
        <Button size="sm" variant="secondary" icon="download" onClick={handleImport} disabled={!canImport || importing}>
          {importing ? "Importing..." : "Import from /models"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={testingAllModels ? "progress_activity" : "science"}
          onClick={handleTestAllModels}
          disabled={testingAllModels || !!testingModelId || allModels.length === 0}
        >
          {testingAllModels ? "Testing..." : "Test All"}
        </Button>
      </div>

      {!canImport && (
        <p className="text-xs text-muted-foreground">
          Add a connection to enable importing models.
        </p>
      )}

      {allModels.length > 0 ? (
        <ModelListView
          items={listItems}
          copied={copied}
          onCopy={onCopy}
          testingModelId={testingModelId}
          testingAll={testingAllModels}
          emptyText="No compatible models added yet."
        />
      ) : (
        <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          No compatible models added yet. Type a model id above or import from /models.
        </div>
      )}
    </div>
  );
}

CompatibleModelsSection.propTypes = {
  providerStorageAlias: PropTypes.string.isRequired,
  providerDisplayAlias: PropTypes.string.isRequired,
  modelAliases: PropTypes.object.isRequired,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  onSetAlias: PropTypes.func.isRequired,
  onDeleteAlias: PropTypes.func.isRequired,
  connections: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      isActive: PropTypes.bool,
    }),
  ).isRequired,
  isAnthropic: PropTypes.bool,
};
