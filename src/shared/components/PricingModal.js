"use client";

import { useCallback, useEffect, useState } from "react";
import Modal, { ConfirmModal } from "./Modal";
import Button from "./Button";
import { Input as UIInput } from "./ui/input";
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
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;

    setPricingData(prev => {
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
        body: JSON.stringify(pricingData)
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

  const allProviders = Object.keys(pricingData).sort();

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Pricing configuration"
        description="All rates are dollars per million tokens ($/1M). An input rate of 2.50 means $2.50 per 1,000,000 input tokens."
        size="full"
        bodyClassName="p-0"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/5"
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
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-foreground">
                {error}
              </p>
            ) : null}

            {allProviders.map(provider => {
              const models = Object.keys(pricingData[provider]).sort();
              return (
                <div key={provider} className="overflow-hidden rounded-lg border">
                  <div className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold">
                    {provider}
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
                        {models.map(model => (
                          <tr key={model}>
                            <td className="px-3 py-2 font-medium">{model}</td>
                            {PRICING_FIELDS.map(field => (
                              <td key={field} className="px-3 py-2">
                                <UIInput
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  aria-label={`${provider} ${model} ${FIELD_LABELS[field]} rate`}
                                  value={pricingData[provider][model][field] || 0}
                                  onChange={(e) => handlePricingChange(provider, model, field, e.target.value)}
                                  className="ml-auto w-24 text-right tabular-nums"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {allProviders.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No pricing data available.
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
