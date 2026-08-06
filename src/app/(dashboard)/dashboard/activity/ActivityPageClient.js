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
    <div className="flex min-w-0 flex-col gap-6 pb-8">
      {/* Title/description are rendered once by the shared Header. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            options={TABS}
            value={activeTab}
            onChange={handleTabChange}
            className="w-full sm:w-auto"
          />
          <Badge variant="outline" size="sm">Admin only</Badge>
        </div>
        <PeriodDropdown value={period} onChange={setPeriod} className="w-full sm:w-auto" />
      </div>

      {activeTab === "overview" && <SystemUsageTab period={period} />}
      {activeTab === "providers" && <ProviderActivityTab period={period} />}
      {activeTab === "requests" && <RequestActivityTab period={period} />}
    </div>
  );
}
