"use client";

import { cn } from "@/shared/utils/cn";

export default function SegmentedControl({
  options = [],
  value,
  onChange,
  size = "md",
  className,
}) {
  const sizes = {
    sm: "h-7 text-[12px]",
    md: "h-8 text-[13px]",
    lg: "h-10 text-sm",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center p-0.5 rounded-md overflow-x-auto border border-border bg-bg-subtle",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "shrink-0 px-3 rounded-[5px] font-medium transition-colors duration-150 inline-flex items-center",
            sizes[size],
            value === option.value
              ? "bg-card text-foreground shadow-soft"
              : "text-text-muted hover:text-foreground"
          )}
        >
          {option.icon && (
            <span className="material-symbols-outlined text-[16px] mr-1.5 leading-none">
              {option.icon}
            </span>
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}
