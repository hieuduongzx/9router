"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SegmentedControl, Badge, PeriodDropdown } from "@/shared/components";
import SystemUsageTab from "./components/SystemUsageTab";
import ProviderActivityTab from "./components/ProviderActivityTab";
import RequestActivityTab from "./components/RequestActivityTab";

const TABS = [
  { value: "overview", label: "System" },
  { value: "providers", label: "Providers" },
  { value: "requests", label: "Requests" },
];

export default function ActivityPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [period, setPeriod] = useState("24h");
  const requestedTab = searchParams.get("tab");
  const activeTab = TABS.some((tab) => tab.value === requestedTab) ? requestedTab : "overview";

  const handleTabChange = (value) => {
    if (value === activeTab) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.push(`/dashboard/activity?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 pb-8 sm:px-0">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-semibold tracking-[-0.02em] text-text-main">Operations activity</h1>
            <Badge variant="outline" size="sm">Admin only</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Monitor system traffic, provider routing, account ownership, and request-level diagnostics.
          </p>
        </div>
        <PeriodDropdown value={period} onChange={setPeriod} className="w-full lg:w-auto" />
      </header>

      <SegmentedControl
        options={TABS}
        value={activeTab}
        onChange={handleTabChange}
        className="w-full sm:w-auto sm:self-start"
      />

      {activeTab === "overview" && <SystemUsageTab period={period} />}
      {activeTab === "providers" && <ProviderActivityTab period={period} />}
      {activeTab === "requests" && <RequestActivityTab period={period} />}
    </div>
  );
}
