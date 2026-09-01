"use client";

import { cn } from "@/shared/utils/cn";
import { Icon } from "@/shared/components/ui/icon";

export default function SegmentedControl({
  options = [],
  value,
  onChange,
  size = "md",
  className,
}) {
  const sizes = {
    sm: "h-7 text-xs",
    md: "h-9 text-sm",
    lg: "h-10 text-sm",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 overflow-x-auto rounded-sm border border-border bg-surface-2 p-1",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-sm px-3 font-mono font-medium transition-colors",
            sizes[size],
            value === option.value
              ? "bg-surface text-foreground border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.icon && (
            <Icon name={option.icon} className="mr-1.5 size-[16px]" />
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}
