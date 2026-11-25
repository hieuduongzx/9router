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
    sm: "h-7 px-2.5 text-xs leading-4",
    md: "h-8 px-3 text-[13px] leading-4",
    lg: "h-9 px-3.5 text-sm leading-4",
  };

  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-muted/60 p-1",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border font-sans font-medium transition-colors",
            sizes[size] || sizes.md,
            value === option.value
              ? "border-border bg-background text-foreground shadow-xs"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {option.icon && <Icon name={option.icon} className="mr-1.5 size-3.5" />}
          {option.label}
        </button>
      ))}
    </div>
  );
}
