"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import StatTile from "@/shared/components/StatTile";
import EmptyState from "@/shared/components/EmptyState";
import PricingModal from "@/shared/components/PricingModal";
import { getDefaultPricing } from "open-sse/providers/pricing.js";
import { cn } from "@/shared/utils/cn";

const RATE_FIELDS = [
  { id: "input", label: "Input" },
  { id: "output", label: "Output" },
  { id: "cached", label: "Cached" },
  { id: "reasoning", label: "Reasoning" },
  { id: "cache_creation", label: "Cache creation" },
];

function countModels(pricing) {
  return Object.values(pricing || {}).reduce(
    (total, models) => total + Object.keys(models || {}).length,
    0,
  );
}

/** Models whose stored rates differ from the catalog defaults. */
function countCustomModels(pricing) {
  const defaults = getDefaultPricing();
  let count = 0;
  for (const [provider, models] of Object.entries(pricing || {})) {
    for (const [model, rates] of Object.entries(models || {})) {
      const baseline = defaults?.[provider]?.[model];
      if (!baseline) {
        count += 1;
        continue;
      }
      const differs = RATE_FIELDS.some(
        ({ id }) => Number(rates?.[id] ?? 0) !== Number(baseline?.[id] ?? 0),
      );
      if (differs) count += 1;
    }
  }
  return count;
}

export default function PricingSettingsPage() {
  const [showModal, setShowModal] = useState(false);
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPricing = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/pricing", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      setPricing(await response.json());
    } catch {
      setError("Pricing data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(loadPricing, 0);
    return () => clearTimeout(timeoutId);
  }, [loadPricing]);

  const providers = useMemo(() => Object.keys(pricing || {}).sort(), [pricing]);
  const modelCount = useMemo(() => countModels(pricing), [pricing]);
  const customCount = useMemo(
    () => (pricing ? countCustomModels(pricing) : 0),
    [pricing],
  );

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-8">
      {error ? (
        <div
          role="status"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground"
        >
          {error}
        </div>
      ) : null}

      <div className="tile-grid grid-cols-1 sm:grid-cols-3">
        <StatTile
          chip="info"
          label="Models priced"
          value={loading ? "…" : String(modelCount)}
          meta="catalog"
        />
        <StatTile
          chip="requests"
          label="Providers"
          value={loading ? "…" : String(providers.length)}
          meta="catalog"
        />
        <StatTile
          chip="cost"
          label="Custom rates"
          value={loading ? "…" : String(customCount)}
          meta={customCount ? "overrides" : "defaults"}
          action={
            <Button variant="outline" size="sm" icon="edit" onClick={() => setShowModal(true)}>
              Edit pricing
            </Button>
          }
        />
      </div>

      <Card title="Current pricing" subtitle="Rates are dollars per million tokens">
        {loading ? (
          <p className="py-4 text-sm text-muted-foreground">Loading pricing data…</p>
        ) : providers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="thead-data">
                <tr>
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4 text-right">Models</th>
                  <th className="py-2 text-right">Custom</th>
                </tr>
              </thead>
              <tbody className="tbody-data">
                {providers.map((provider) => {
                  const models = pricing[provider] || {};
                  const custom = Object.keys(models).length
                    ? countCustomModels({ [provider]: models })
                    : 0;
                  return (
                    <tr
                      key={provider}
                    >
                      <td className="py-2.5 pr-4 font-medium text-foreground">{provider}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                        {Object.keys(models).length}
                      </td>
                      <td
                        className={cn(
                          "py-2.5 text-right tabular-nums",
                          custom ? "text-foreground" : "text-muted-foreground/60",
                        )}
                      >
                        {custom || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No pricing data"
            description="Pricing rates appear once the catalog is loaded."
          />
        )}
      </Card>

      <Card title="How pricing works" icon="payments">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Cost calculation:</strong> each request&apos;s cost is
            (input tokens × input rate) + (output tokens × output rate) + (cached tokens × cached
            rate).
          </p>
          <p>
            <strong className="text-foreground">Pricing format:</strong> all rates are dollars per
            million tokens ($/1M). An input rate of 2.50 means $2.50 per 1,000,000 input tokens.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong className="text-foreground">Input:</strong> standard prompt tokens</li>
            <li><strong className="text-foreground">Output:</strong> completion/response tokens</li>
            <li><strong className="text-foreground">Cached:</strong> cached input tokens (typically 50% of input rate)</li>
            <li><strong className="text-foreground">Reasoning:</strong> thinking tokens (falls back to output rate)</li>
            <li><strong className="text-foreground">Cache creation:</strong> tokens used to create cache entries (falls back to input rate)</li>
          </ul>
          <p>
            <strong className="text-foreground">Custom pricing:</strong> per-route overrides are
            edited in Model Routes; this page edits the global rate table. Reset to defaults anytime.
          </p>
        </div>
      </Card>

      {showModal ? (
        <PricingModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSave={loadPricing}
        />
      ) : null}
    </div>
  );
}
