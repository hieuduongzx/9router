"use client";

import { cn } from "@/shared/utils/cn";

/**
 * A tiny ring/donut at the bottom of a stat tile.
 *
 * `value` is 0..1, the centre slot is the value rendered in mono. Renders as
 * a 16px-wide circle because the tile already has the big number at the top;
 * the ring is the secondary signal, not the headline.
 */
export default function MiniRing({
  value = 0,
  color = "var(--primary)",
  trackColor = "var(--muted)",
  className,
  label,
}) {
  const safe = Math.min(1, Math.max(0, Number(value) || 0));
  const radius = 7;
  const stroke = 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safe);

  return (
    <div className={cn("flex h-full w-full items-center gap-2", className)}>
      <svg
        viewBox="0 0 20 20"
        width="20"
        height="20"
        aria-hidden
        className="shrink-0"
      >
        <circle cx="10" cy="10" r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx="10"
          cy="10"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 10 10)"
        />
      </svg>
      {label ? (
        <span className="truncate text-xs tabular-nums text-muted-foreground">{label}</span>
      ) : null}
    </div>
  );
}
