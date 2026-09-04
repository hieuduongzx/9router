"use client";

import PropTypes from "prop-types";
import { cn } from "@/shared/utils/cn";

/**
 * Data-role chips: pick by what the number *means*, never by which colour looks
 * nice. tokens=violet, requests=amber, cost/credit=green, failures=red,
 * healthy=green, neutral counts=blue.
 */
const CHIP_COLORS = {
  tokens: "bg-[var(--chip-tokens)]",
  requests: "bg-[var(--chip-requests)]",
  cost: "bg-[var(--chip-cost)]",
  danger: "bg-[var(--chip-danger)]",
  info: "bg-[var(--chip-info)]",
  success: "bg-[var(--success)]",
  muted: "bg-muted-foreground",
};

/**
 * Period-over-period movement. The tone is passed in rather than derived from
 * the sign because "up" is not universally good — more spend is not a win, so
 * cost tiles pass `neutral` and keep the number muted instead of green.
 */
function Delta({ value, tone }) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  let color = "text-muted-foreground";
  if (tone !== "neutral" && rounded > 0) color = "text-success";
  else if (tone !== "neutral" && rounded < 0) color = "text-destructive";
  return (
    <span className={cn("text-xs font-medium tabular-nums", color)}>
      {rounded > 0 ? "+" : ""}
      {rounded}%
    </span>
  );
}

Delta.propTypes = {
  value: PropTypes.number,
  tone: PropTypes.oneOf(["auto", "neutral"]),
};

/**
 * One tile in a `.tile-grid` row.
 *
 * Slots: `action` is a control on the right of the label; `meta` is a small
 * timestamp/period string on the right of the value; `chart` is a small
 * sparkline or ring anchored to the bottom-right of the tile (caller-supplied
 * node, so a tile can put a line, a bar, or a ring without StatTile having to
 * know about Recharts).
 */
export default function StatTile({
  chip = "muted",
  label,
  value,
  unit,
  sub,
  meta,
  action,
  delta,
  deltaTone = "auto",
  bar,
  chart,
  className,
}) {
  return (
    <div className={cn("relative p-4 sm:p-5", className)}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn("size-2 shrink-0 rounded-sm", CHIP_COLORS[chip] || CHIP_COLORS.muted)}
            aria-hidden
          />
          <span className="truncate text-xs font-medium leading-4 text-muted-foreground">{label}</span>
        </div>
        {action}
      </div>
      <div className="flex items-baseline gap-x-2 gap-y-1">
        <span
          className="font-sans text-[18px] leading-6 font-semibold tabular-nums"
          style={{ letterSpacing: "-0.1px" }}
        >
          {value}
        </span>
        {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
        <Delta value={delta} tone={deltaTone} />
        {meta ? (
          <span className="ml-auto shrink-0 self-end pb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
            {meta}
          </span>
        ) : null}
      </div>
      {Number.isFinite(bar?.value) ? (
        <div className="mt-3 h-1.5 w-full rounded-full bg-muted" aria-hidden>
          <div
            className={cn(
              "h-full rounded-full",
              CHIP_COLORS[bar.chip || chip] || CHIP_COLORS.muted,
            )}
            style={{ width: `${Math.min(100, Math.max(0, bar.value * 100))}%` }}
          />
        </div>
      ) : null}
      {sub && !chart ? (
        <div className="mt-1.5 truncate text-xs text-muted-foreground">{sub}</div>
      ) : null}
      {chart ? (
        <div className="mt-2.5 h-12 w-full">{chart}</div>
      ) : null}
    </div>
  );
}

StatTile.propTypes = {
  chip: PropTypes.string,
  label: PropTypes.node,
  value: PropTypes.node,
  unit: PropTypes.node,
  sub: PropTypes.node,
  meta: PropTypes.node,
  action: PropTypes.node,
  delta: PropTypes.number,
  deltaTone: PropTypes.oneOf(["auto", "neutral"]),
  bar: PropTypes.shape({ value: PropTypes.number, chip: PropTypes.string }),
  chart: PropTypes.node,
  className: PropTypes.string,
};
