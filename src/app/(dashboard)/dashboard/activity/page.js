"use client";

import { useState } from "react";
import { RequestLogger, SegmentedControl } from "@/shared/components";
import SystemUsageTab from "./components/SystemUsageTab";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
  { value: "all", label: "All" },
];


export default function ActivityPage() {
  const [period, setPeriod] = useState("today");

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
      <div className="flex justify-end">
        <SegmentedControl
          options={PERIODS}
          value={period}
          onChange={setPeriod}
          size="sm"
          className="w-full sm:w-auto"
        />
      </div>

      <SystemUsageTab period={period} />
      <RequestLogger key={period} period={period} />
    </div>
  );
}

