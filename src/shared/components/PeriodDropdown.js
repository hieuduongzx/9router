"use client";

import { cn } from "@/shared/utils/cn";
import { USAGE_PERIODS } from "@/shared/constants/usagePeriods";

/** Native-select time-range picker, styled to match the flat/hairline system. */
export default function PeriodDropdown({ value, onChange, disabled = false, className, options = USAGE_PERIODS }) {
  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-8 appearance-none rounded-sm border border-border bg-surface py-1 pl-3 pr-8 font-mono text-xs font-medium text-text-main",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
        aria-label="Time range"
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] text-text-muted">
        expand_more
      </span>
    </div>
  );
}
