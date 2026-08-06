"use client";

import PropTypes from "prop-types";
import { cn } from "@/shared/utils/cn";

/**
 * Data-role chips (see DESIGN.md). Pick by what the number *means*, never by
 * the colour you want: tokens=violet, requests=amber, cost/credit=green,
 * failures=red, healthy=green, neutral counts=blue.
 */
const CHIP_COLORS = {
  tokens: "bg-[var(--color-chip-tokens)]",
  requests: "bg-[var(--color-chip-requests)]",
  cost: "bg-[var(--color-chip-cost)]",
  danger: "bg-[var(--color-chip-danger)]",
  info: "bg-[var(--color-chip-info)]",
  success: "bg-success",
  muted: "bg-text-muted",
};

/**
 * Period-over-period movement. The tone is passed in rather than derived from
 * the sign because "up" is not universally good — more spend is not a win, so
 * cost tiles pass `neutral` and keep the number muted instead of green.
 */
function Delta({ value, tone }) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  let color = "text-text-muted";
  if (tone !== "neutral" && rounded > 0) color = "text-success";
  else if (tone !== "neutral" && rounded < 0) color = "text-danger";
  return (
    <span className={cn("font-mono text-xs font-semibold tabular-nums", color)}>
      {rounded > 0 ? "+" : ""}
      {rounded}%
    </span>
  );
}

Delta.propTypes = { value: PropTypes.number, tone: PropTypes.oneOf(["auto", "neutral"]) };

/** One tile in a `.tile-grid` row — flat, hairline-fused stat cell. */
export default function StatTile({
  chip = "muted",
  label,
  value,
  unit,
  sub,
  action,
  delta,
  deltaTone = "auto",
  bar,
  className,
}) {
  return (
    <div className={cn("p-5 sm:p-6", className)}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("size-2 shrink-0", CHIP_COLORS[chip] || CHIP_COLORS.muted)} aria-hidden />
          <span className="truncate font-mono text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {label}
          </span>
        </div>
        {action}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-text-main sm:text-[28px]">
          {value}
        </span>
        {unit && <span className="text-sm text-text-muted">{unit}</span>}
        <Delta value={delta} tone={deltaTone} />
      </div>
      {Number.isFinite(bar?.value) && (
        <div className="mt-3 h-1.5 w-full bg-surface-2" aria-hidden>
          <div
            className={cn("h-full", CHIP_COLORS[bar.chip || chip] || CHIP_COLORS.muted)}
            style={{ width: `${Math.min(100, Math.max(0, bar.value * 100))}%` }}
          />
        </div>
      )}
      {sub && <div className="mt-1.5 truncate text-xs text-text-muted">{sub}</div>}
    </div>
  );
}

StatTile.propTypes = {
  chip: PropTypes.string,
  label: PropTypes.node,
  value: PropTypes.node,
  unit: PropTypes.node,
  sub: PropTypes.node,
  action: PropTypes.node,
  delta: PropTypes.number,
  deltaTone: PropTypes.oneOf(["auto", "neutral"]),
  bar: PropTypes.shape({ value: PropTypes.number, chip: PropTypes.string }),
  className: PropTypes.string,
};
