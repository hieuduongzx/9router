"use client";

import { cn } from "@/shared/utils/cn";

const CHIP_COLORS = {
  tokens: "bg-[var(--color-chip-tokens)]",
  requests: "bg-[var(--color-chip-requests)]",
  cost: "bg-[var(--color-chip-cost)]",
  danger: "bg-[var(--color-chip-danger)]",
  info: "bg-[var(--color-chip-info)]",
  muted: "bg-text-muted",
};

/** One tile in a `.tile-grid` row — flat, hairline-fused stat cell. */
export default function StatTile({ chip = "muted", label, value, unit, sub, action, className }) {
  return (
    <div className={cn("p-5 sm:p-6", className)}>
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 shrink-0", CHIP_COLORS[chip] || CHIP_COLORS.muted)} aria-hidden />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {label}
          </span>
        </div>
        {action}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-text-main sm:text-[28px]">
          {value}
        </span>
        {unit && <span className="text-sm text-text-muted">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-text-muted">{sub}</div>}
    </div>
  );
}
