"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Modal, { ConfirmModal } from "./Modal";
import Button from "./Button";
import { Input as UIInput } from "./ui/input";
import { Icon } from "./ui/icon";
import { getDefaultPricing } from "open-sse/providers/pricing.js";

const PRICING_FIELDS = ["input", "output", "cached", "reasoning", "cache_creation"];
const FIELD_LABELS = {
  input: "Input",
  output: "Output",
  cached: "Cached",
  reasoning: "Reasoning",
  cache_creation: "Cache creation",
};

export default function PricingModal({ isOpen, onClose, onSave }) {
  const [pricingData, setPricingData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("all");

  const loadPricing = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/pricing", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      setPricingData(await response.json());
    } catch {
      setPricingData(getDefaultPricing());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const timeoutId = setTimeout(loadPricing, 0);
    return () => clearTimeout(timeoutId);
  }, [isOpen, loadPricing]);

  const handlePricingChange = (provider, model, field, value) => {
    const numValue = value === "" ? 0 : parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;

    setPricingData((prev) => {
      const newData = { ...prev };
      if (!newData[provider]) newData[provider] = {};
      if (!newData[provider][model]) newData[provider][model] = {};
      newData[provider][model] = { ...newData[provider][model], [field]: numValue };
      return newData;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pricingData),
      });

      if (response.ok) {
        onSave?.();
        onClose();
      } else {
        const body = await response.json().catch(() => ({}));
        setError(body?.error || "Failed to save pricing.");
      }
    } catch {
      setError("Failed to save pricing.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetOpen(false);
    setError("");
    try {
      const response = await fetch("/api/pricing", { method: "DELETE" });
      if (response.ok) {
        setPricingData(getDefaultPricing());
      } else {
        setError("Failed to reset pricing.");
      }
    } catch {
      setError("Failed to reset pricing.");
    }
  };

  const allProviders = useMemo(() => Object.keys(pricingData).sort(), [pricingData]);

  const filteredProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allProviders
      .filter((provider) => selectedProvider === "all" || provider === selectedProvider)
      .map((provider) => {
        const models = Object.keys(pricingData[provider] || {})
          .sort()
          .filter(
            (model) =>
              !q ||
              provider.toLowerCase().includes(q) ||
              model.toLowerCase().includes(q),
          );
        return { provider, models };
      })
      .filter((entry) => entry.models.length > 0);
  }, [allProviders, pricingData, searchQuery, selectedProvider]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Pricing configuration"
        description="All rates are USD per million tokens ($/1M). An input rate of 2.50 means $2.50 per 1,000,000 input tokens."
        size="full"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/5"
              onClick={() => setResetOpen(true)}
              disabled={saving}
            >
              Reset to defaults
            </Button>
            <div className="flex gap-2 sm:justify-end">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>
                Save changes
              </Button>
            </div>
          </div>
        }
      >
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading pricing data…</p>
        ) : (
          <div className="flex flex-col gap-4">
            {error ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-foreground"
              >
                {error}
              </p>
            ) : null}

            <div className="sticky top-0 z-10 -mx-5 -mt-5 flex flex-wrap items-center gap-2 border-b bg-background/95 px-5 py-3 backdrop-blur">
              <div className="relative min-w-[200px] flex-1">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <UIInput
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by provider or model..."
                  className="h-9 pl-8 pr-8 text-sm"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear filter"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <Icon name="close" className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                aria-label="Filter provider"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
              >
                <option value="all">All providers ({allProviders.length})</option>
                {allProviders.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </div>

            {filteredProviders.map(({ provider, models }) => (
              <div key={provider} className="overflow-hidden rounded-lg border">
                <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-sm font-semibold">
                  <span>{provider}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {models.length} {models.length === 1 ? "model" : "models"}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="thead-data">
                      <tr>
                        <th className="px-3 py-2 text-left">Model</th>
                        {PRICING_FIELDS.map((field) => (
                          <th key={field} className="px-3 py-2 text-right">
                            {FIELD_LABELS[field]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="tbody-data">
                      {models.map((model) => (
                        <tr key={model}>
                          <td className="px-3 py-2 font-mono text-xs font-medium">{model}</td>
                          {PRICING_FIELDS.map((field) => (
                            <td key={field} className="px-3 py-2">
                              <UIInput
                                type="number"
                                step="0.01"
                                min="0"
                                aria-label={`${provider} ${model} ${FIELD_LABELS[field]} rate`}
                                value={pricingData[provider][model][field] ?? 0}
                                onChange={(e) => handlePricingChange(provider, model, field, e.target.value)}
                                className="ml-auto h-8 w-24 text-right tabular-nums"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {filteredProviders.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {allProviders.length === 0
                  ? "No pricing data available."
                  : "No models match your current filter."}
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleReset}
        title="Reset pricing?"
        message="Reset every provider and model to the catalog defaults. Custom rates are lost."
        confirmText="Reset to defaults"
        cancelText="Cancel"
      />
    </>
  );
}
