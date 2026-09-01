"use client";

import { useEffect, useState, Suspense } from "react";
import {
  UsageStats,
  CardSkeleton,
  PeriodDropdown,
  Select,
} from "@/shared/components";

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
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Select
          aria-label="Filter by API key"
          value={apiKeyId}
          onChange={(event) => setApiKeyId(event.target.value)}
          className="w-full sm:w-52"
          options={[
            { value: "all", label: "All API keys" },
            ...apiKeys.map((k) => ({
              value: k.id,
              label: k.name || (k.key ? `${k.key.slice(0, 12)}…` : k.id),
            })),
          ]}
        />
        <PeriodDropdown value={period} onChange={setPeriod} />
      </div>

      <Suspense fallback={<CardSkeleton />}>
        <UsageStats period={period} setPeriod={setPeriod} apiKeyId={apiKeyId} hidePeriodSelector />
      </Suspense>
    </div>
  );
}
