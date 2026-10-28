"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CardSkeleton, SegmentedControl } from "@/shared/components";
import UsageStats from "@/shared/components/UsageStats";
import { useShellPath } from "@/shared/hooks/useShellPath";
import RequestDetailsTab from "./components/RequestDetailsTab";

// Short labels for the segmented control; values are the shared USAGE_PERIODS
// set so every request this page makes uses a period the API validates.
const PERIODS = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "all", label: "All" },
];

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "details", label: "Request history" },
];

export default function UsagePage({ variant = "user" }) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <UsageContent variant={variant} />
    </Suspense>
  );
}

function UsageContent({ variant = "user" }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shellPath = useShellPath();

  const [period, setPeriod] = useState("today");

  const tabFromUrl = searchParams.get("tab");
  const activeTab = TABS.some((tab) => tab.value === tabFromUrl) ? tabFromUrl : "overview";

  const handleTabChange = (value) => {
    if (value === activeTab) return;
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    // Stay inside the current shell (/dashboard or /admin) instead of jumping out of it.
    router.push(`${shellPath("/dashboard/usage")}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          options={TABS}
          value={activeTab}
          onChange={handleTabChange}
          className="w-full sm:w-auto"
        />
        {activeTab === "overview" && (
          <SegmentedControl
            options={PERIODS}
            value={period}
            onChange={setPeriod}
            size="sm"
            className="w-full sm:w-auto"
          />
        )}
      </div>

      {activeTab === "overview" && (
        <Suspense fallback={<CardSkeleton />}>
          <UsageStats period={period} setPeriod={setPeriod} hidePeriodSelector variant={variant} />
        </Suspense>
      )}
      {/* The history tab owns its range (incl. custom dates); it starts from the overview's period. */}
      {activeTab === "details" && <RequestDetailsTab period={period} />}
    </div>
  );
}
