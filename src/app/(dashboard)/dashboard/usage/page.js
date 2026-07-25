"use client";

import { Suspense, useEffect, useState } from "react";
import { UsageStats, CardSkeleton, PeriodDropdown } from "@/shared/components";

export default function UsagePage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <UsageContent />
    </Suspense>
  );
}

function UsageContent() {
  const [period, setPeriod] = useState("24h");
  const [apiKeyId, setApiKeyId] = useState("all");
  const [apiKeys, setApiKeys] = useState([]);

  useEffect(() => {
    fetch("/api/keys", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setApiKeys(Array.isArray(d?.keys) ? d.keys : []))
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
      <header>
        <h1 className="font-mono text-xl font-semibold tracking-tight text-text-main">{"// "}Usage</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">
          Review request volume, tokens, cache utilization, and estimated cost by routed model.
        </p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
          <label className="flex min-w-0 items-center gap-2 font-mono text-sm text-text-muted">
            <span className="material-symbols-outlined text-[18px] shrink-0">key</span>
            <select
              value={apiKeyId}
              onChange={(e) => setApiKeyId(e.target.value)}
              className="min-w-0 flex-1 rounded-sm border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary/40 sm:w-44"
              title="Filter usage by API key"
            >
              <option value="all">All API keys</option>
              {apiKeys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name || k.key?.slice(0, 12) + "…"}
                </option>
              ))}
            </select>
          </label>
          <PeriodDropdown value={period} onChange={setPeriod} />
        </div>
      </div>

      <Suspense fallback={<CardSkeleton />}>
        <UsageStats
          period={period}
          setPeriod={setPeriod}
          apiKeyId={apiKeyId}
          hidePeriodSelector
        />
      </Suspense>
    </div>
  );
}
