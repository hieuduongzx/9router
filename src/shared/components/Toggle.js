"use client";

import { cn } from "@/shared/utils/cn";

export default function Toggle({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  size = "md",
  className,
}) {
  const sizes = {
    sm: { track: "h-5 w-9", thumb: "size-4", on: "translate-x-4", off: "translate-x-0.5" },
    md: { track: "h-6 w-11", thumb: "size-5", on: "translate-x-5", off: "translate-x-0.5" },
    lg: { track: "h-7 w-14", thumb: "size-6", on: "translate-x-7", off: "translate-x-0.5" },
  };

  return (
    <div className={cn("flex items-center gap-3", disabled && "opacity-50", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={cn(
          "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          checked ? "bg-primary" : "bg-surface-3",
          sizes[size].track,
          disabled && "cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "pointer-events-none block rounded-full bg-white ring-0 transition-transform",
            sizes[size].thumb,
            checked ? sizes[size].on : sizes[size].off
          )}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && <span className="font-mono text-sm font-medium leading-none text-text-main">{label}</span>}
          {description && <span className="text-xs text-text-muted">{description}</span>}
        </div>
      )}
    </div>
  );
}
